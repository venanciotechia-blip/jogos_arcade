'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Trophy, Zap, Menu } from 'lucide-react';
import { sound } from '@/lib/sound';
import { getHighScore, saveHighScore } from '@/lib/gameStore';
import { awardAuraWin } from '@/lib/auraStore';

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
  trail: { x: number; y: number }[];
}

interface Bumper {
  x: number;
  y: number;
  radius: number;
  points: number;
  flash: number;
}

interface FloatingScore {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
}

const WIDTH = 420;
const HEIGHT = 630;
const GRAVITY = 0.23;
const BALL_RADIUS = 8.5;

const MISSIONS = [
  {
    id: 'ramp_training',
    sub: 'Launch Ramp To Accept',
    title: 'Launch Training',
    target: 'ramp',
    needed: 1,
    points: 15000,
  },
  {
    id: 'bumpers_research',
    sub: 'Overcharge Energy Coils',
    title: 'Bumper Cascade',
    target: 'bumpers',
    needed: 6,
    points: 25000,
  },
  {
    id: 'vortex_jump',
    sub: 'Activate Wormhole Core',
    title: 'Hyperspace Jump',
    target: 'vortex',
    needed: 2,
    points: 50000,
  },
  {
    id: 'multiball_alert',
    sub: 'Maximum Fleet Readiness',
    title: 'Super Multiball!',
    target: 'all',
    needed: 1,
    points: 100000,
  },
];

export function PinballGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'GAMEOVER'>('IDLE');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => getHighScore('pinball'));
  const [ballCount, setBallCount] = useState(3);
  const [multiplier, setMultiplier] = useState(1);
  const [currentMissionIdx, setCurrentMissionIdx] = useState(0);
  const [missionProgress, setMissionProgress] = useState(0);
  const [multiballActive, setMultiballActive] = useState(false);
  const [plungerTension, setPlungerTension] = useState(0);
  const [showMenuModal, setShowMenuModal] = useState(false);

  // Engine Refs
  const ballsRef = useRef<Ball[]>([]);
  const ballIdCounterRef = useRef(1);
  const multiballActiveRef = useRef(false);

  // Left & Right Flippers (Sleek Modern Proportions)
  const leftFlipperRef = useRef({
    x: 125,
    y: 535,
    length: 58,
    restAngle: 0.52,
    upAngle: -0.48,
    currentAngle: 0.52,
    angularVelocity: 0,
    isPressed: false,
  });

  const rightFlipperRef = useRef({
    x: 265,
    y: 535,
    length: 58,
    restAngle: Math.PI - 0.52,
    upAngle: Math.PI + 0.48,
    currentAngle: Math.PI - 0.52,
    angularVelocity: 0,
    isPressed: false,
  });

  // Plunger
  const plungerRef = useRef({
    tension: 0,
    isCharging: false,
  });

  // Modern 3 Pop Bumpers (Inverted Triangle matching reference image)
  const bumpersRef = useRef<Bumper[]>([
    { x: 195, y: 205, radius: 23, points: 500, flash: 0 },
    { x: 260, y: 195, radius: 23, points: 500, flash: 0 },
    { x: 215, y: 265, radius: 24, points: 750, flash: 0 },
  ]);

  // Upper Rollover Lights
  const rolloversRef = useRef([
    { x: 140, y: 125, active: false },
    { x: 190, y: 110, active: false },
    { x: 245, y: 115, active: false },
  ]);

  // Center Vortex
  const vortexRef = useRef({
    x: 210,
    y: 385,
    radius: 38,
    coreRadius: 12,
    rotation: 0,
    pulse: 0,
  });

  // Particles & Animations
  const particlesRef = useRef<Particle[]>([]);
  const floatingScoresRef = useRef<FloatingScore[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Add Score helper
  const addScore = useCallback((pts: number, x: number, y: number, color = '#38bdf8') => {
    setMultiplier((mult) => {
      const finalPts = pts * mult;
      setScore((s) => {
        const next = s + finalPts;
        saveHighScore('pinball', next);
        setHighScore((h) => Math.max(h, next));
        return next;
      });

      floatingScoresRef.current.push({
        id: Date.now() + Math.random(),
        x,
        y,
        text: mult > 1 ? `+${finalPts.toLocaleString('pt-BR')} (${mult}x)` : `+${finalPts.toLocaleString('pt-BR')}`,
        color,
        alpha: 1,
      });

      return mult;
    });
  }, []);

  // Spawn Steel Ball in Shooter Lane (x: 395, y: 550)
  const spawnBall = useCallback(() => {
    ballsRef.current.push({
      id: ballIdCounterRef.current++,
      x: 395,
      y: 555,
      vx: 0,
      vy: 0,
      radius: BALL_RADIUS,
      active: true,
      trail: [],
    });
  }, []);

  const resetGame = useCallback(() => {
    ballsRef.current = [];
    particlesRef.current = [];
    floatingScoresRef.current = [];
    rolloversRef.current.forEach((r) => (r.active = false));
    multiballActiveRef.current = false;
    setScore(0);
    setMultiplier(1);
    setCurrentMissionIdx(0);
    setMissionProgress(0);
    setMultiballActive(false);
    setBallCount(3);
    setGameState('PLAYING');
    sound.playClick();
    spawnBall();
  }, [spawnBall]);

  // Mission progression trigger
  const advanceMission = useCallback((targetType: 'ramp' | 'bumpers' | 'vortex') => {
    setCurrentMissionIdx((currIdx) => {
      const mission = MISSIONS[currIdx];
      if (!mission) return currIdx;

      if (mission.target === targetType || mission.target === 'all') {
        setMissionProgress((prev) => {
          const nextVal = prev + 1;
          if (nextVal >= mission.needed) {
            sound.playCheer();
            addScore(mission.points, 210, 200, '#a855f7');
            floatingScoresRef.current.push({
              id: Date.now() + Math.random(),
              x: 210,
              y: 180,
              text: `★ MISSION COMPLETED: ${mission.title} ★`,
              color: '#38bdf8',
              alpha: 1,
            });
            awardAuraWin('Pinball Galáctico');

            // Activate Multiball on 3rd mission
            if (currIdx === 2 && !multiballActiveRef.current) {
              multiballActiveRef.current = true;
              setMultiballActive(true);
              sound.playCorrectDing();
              ballsRef.current.push({
                id: ballIdCounterRef.current++,
                x: 210,
                y: 350,
                vx: -3.5,
                vy: -5,
                radius: BALL_RADIUS,
                active: true,
                trail: [],
              });
            }

            return 0; // reset for next mission
          }
          return nextVal;
        });

        if (missionProgress + 1 >= mission.needed) {
          return (currIdx + 1) % MISSIONS.length;
        }
      }
      return currIdx;
    });
  }, [addScore, missionProgress]);

  // Controls Handlers
  const handleLeftDown = useCallback(() => {
    if (!leftFlipperRef.current.isPressed) {
      leftFlipperRef.current.isPressed = true;
      sound.playFlipper();
    }
  }, []);

  const handleLeftUp = useCallback(() => {
    leftFlipperRef.current.isPressed = false;
  }, []);

  const handleRightDown = useCallback(() => {
    if (!rightFlipperRef.current.isPressed) {
      rightFlipperRef.current.isPressed = true;
      sound.playFlipper();
    }
  }, []);

  const handleRightUp = useCallback(() => {
    rightFlipperRef.current.isPressed = false;
  }, []);

  const handlePlungerDown = useCallback(() => {
    plungerRef.current.isCharging = true;
  }, []);

  const handlePlungerUp = useCallback(() => {
    if (!plungerRef.current.isCharging) return;
    plungerRef.current.isCharging = false;
    const power = plungerRef.current.tension;
    plungerRef.current.tension = 0;
    setPlungerTension(0);

    // Launch Ball
    ballsRef.current.forEach((b) => {
      if (b.x > 375 && b.y > 450) {
        sound.playPlunger();
        b.vy = -(10 + power * 16);
        b.vx = -0.5;

        // Particle sparks
        for (let i = 0; i < 12; i++) {
          particlesRef.current.push({
            x: b.x,
            y: b.y + 8,
            vx: (Math.random() - 0.5) * 5,
            vy: Math.random() * 5,
            color: '#38bdf8',
            alpha: 1,
            size: 3,
          });
        }
      }
    });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', ' ', 'z', 'Z', '/', 'a', 'A', 'd', 'D'].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'ArrowLeft' || e.key === 'z' || e.key === 'Z' || e.key === 'a' || e.key === 'A') {
        handleLeftDown();
      }
      if (e.key === 'ArrowRight' || e.key === '/' || e.key === 'd' || e.key === 'D') {
        handleRightDown();
      }
      if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        handlePlungerDown();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'z' || e.key === 'Z' || e.key === 'a' || e.key === 'A') {
        handleLeftUp();
      }
      if (e.key === 'ArrowRight' || e.key === '/' || e.key === 'd' || e.key === 'D') {
        handleRightUp();
      }
      if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        handlePlungerUp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleLeftDown, handleLeftUp, handleRightDown, handleRightUp, handlePlungerDown, handlePlungerUp]);

  // Main 60 FPS Physics & Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      if (gameState === 'PLAYING') {
        updatePhysics();
      }
      render(ctx);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    const updatePhysics = () => {
      // 1. Plunger charge
      if (plungerRef.current.isCharging) {
        plungerRef.current.tension = Math.min(1, plungerRef.current.tension + 0.04);
        setPlungerTension(plungerRef.current.tension);
      }

      // 2. Flipper motion
      const lf = leftFlipperRef.current;
      const rf = rightFlipperRef.current;
      const flipSpeed = 0.36;

      const targetLeft = lf.isPressed ? lf.upAngle : lf.restAngle;
      const prevLeft = lf.currentAngle;
      lf.currentAngle += (targetLeft - lf.currentAngle) * flipSpeed;
      lf.angularVelocity = lf.currentAngle - prevLeft;

      const targetRight = rf.isPressed ? rf.upAngle : rf.restAngle;
      const prevRight = rf.currentAngle;
      rf.currentAngle += (targetRight - rf.currentAngle) * flipSpeed;
      rf.angularVelocity = rf.currentAngle - prevRight;

      // 3. Vortex animation
      vortexRef.current.rotation += 0.03;
      vortexRef.current.pulse = Math.sin(Date.now() * 0.005) * 0.5 + 0.5;

      // 4. Bumper flash decay
      bumpersRef.current.forEach((b) => {
        if (b.flash > 0) b.flash = Math.max(0, b.flash - 0.06);
      });

      // 5. Balls Physics Update
      const activeBalls: Ball[] = [];
      for (const b of ballsRef.current) {
        b.vy += GRAVITY;
        b.vx *= 0.996;
        b.vy *= 0.996;

        // Terminal speed limit
        const spd = Math.hypot(b.vx, b.vy);
        if (spd > 19) {
          b.vx = (b.vx / spd) * 19;
          b.vy = (b.vy / spd) * 19;
        }

        b.x += b.vx;
        b.y += b.vy;

        // Record trailing positions for the glowing comet tail
        b.trail.unshift({ x: b.x, y: b.y });
        if (b.trail.length > 8) b.trail.pop();

        // Particle sparks behind ball
        if (Math.hypot(b.vx, b.vy) > 6 && Math.random() < 0.4) {
          particlesRef.current.push({
            x: b.x,
            y: b.y,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            color: '#38bdf8',
            alpha: 0.8,
            size: 2,
          });
        }

        // Table Borders Collisions
        // Right outer lane wall (x = 408)
        if (b.x > 408 - b.radius) {
          b.x = 408 - b.radius;
          b.vx = -Math.abs(b.vx) * 0.7;
          sound.playBounce();
        }

        // Left outer table wall (x = 18)
        if (b.x < 18 + b.radius) {
          b.x = 18 + b.radius;
          b.vx = Math.abs(b.vx) * 0.75;
          sound.playBounce();
        }

        // Shooter Lane Divider Wall (x = 376, from y = 160 to 570)
        if (b.y > 160 && b.y < 570) {
          if (b.x > 376 - b.radius && b.x < 376 && b.vx > 0) {
            b.x = 376 - b.radius;
            b.vx = -Math.abs(b.vx) * 0.7;
          } else if (b.x < 376 + b.radius && b.x > 376 && b.vx < 0) {
            b.x = 376 + b.radius;
            b.vx = Math.abs(b.vx) * 0.7;
          }
        }

        // Top Arch (Curved Launch Dome)
        if (b.y < 150) {
          const archX = 205;
          const archY = 150;
          const archRad = 190;
          const dist = Math.hypot(b.x - archX, b.y - archY);
          if (dist > archRad - b.radius) {
            const nx = (b.x - archX) / dist;
            const ny = (b.y - archY) / dist;
            b.x = archX + nx * (archRad - b.radius);
            const dot = b.vx * nx + b.vy * ny;
            b.vx = (b.vx - 2 * dot * nx) * 0.82;
            b.vy = (b.vy - 2 * dot * ny) * 0.82;
            sound.playBounce();
          }
        }

        // Left Purple Elevated Curved Ramp Entry (starts at x: 95, y: 340)
        // Ramp path enters and loops upwards around (85, 230)
        const rampDist = Math.hypot(b.x - 95, b.y - 340);
        if (rampDist < 20 && b.vy < 0) {
          // Ball rides the purple ramp!
          sound.playRamp();
          addScore(3000, 95, 300, '#c084fc');
          advanceMission('ramp');

          // Guide ball around the elevated loop curve!
          b.x = 120;
          b.y = 190;
          b.vx = 4;
          b.vy = -3;

          for (let i = 0; i < 10; i++) {
            particlesRef.current.push({
              x: 95 + (Math.random() - 0.5) * 15,
              y: 340 + (Math.random() - 0.5) * 15,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              color: '#d946ef',
              alpha: 1,
              size: 3,
            });
          }
        }

        // Right Red/Orange Booster Ramp Entry (x: 335, y: 300)
        const rightRampDist = Math.hypot(b.x - 335, b.y - 300);
        if (rightRampDist < 18 && b.vy < 0) {
          sound.playRamp();
          addScore(2500, 335, 270, '#f97316');
          b.vx = -3;
          b.vy = -7;
        }

        // Center Energy Vortex / Wormhole (x: 210, y: 385)
        const distVortex = Math.hypot(b.x - vortexRef.current.x, b.y - vortexRef.current.y);
        if (distVortex < vortexRef.current.radius) {
          // Gravity well pull towards the core
          const pull = (vortexRef.current.radius - distVortex) * 0.04;
          const nx = (vortexRef.current.x - b.x) / distVortex;
          const ny = (vortexRef.current.y - b.y) / distVortex;
          b.vx += nx * pull;
          b.vy += ny * pull;

          // Vortex Core hit!
          if (distVortex < vortexRef.current.coreRadius + b.radius) {
            sound.playWarp();
            addScore(2000, vortexRef.current.x, vortexRef.current.y - 15, '#06b6d4');
            advanceMission('vortex');

            // Slingshot ball outward with energetic burst
            const outAngle = Math.random() * Math.PI * 2;
            b.vx = Math.cos(outAngle) * 8;
            b.vy = -Math.abs(Math.sin(outAngle)) * 8;

            for (let i = 0; i < 14; i++) {
              particlesRef.current.push({
                x: vortexRef.current.x,
                y: vortexRef.current.y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                color: '#22d3ee',
                alpha: 1,
                size: 3.5,
              });
            }
          }
        }

        // 3 Modern Pop Bumpers Collision
        bumpersRef.current.forEach((bumper) => {
          const dist = Math.hypot(b.x - bumper.x, b.y - bumper.y);
          if (dist < bumper.radius + b.radius) {
            const nx = (b.x - bumper.x) / dist;
            const ny = (b.y - bumper.y) / dist;
            b.x = bumper.x + nx * (bumper.radius + b.radius);

            const bounceSpeed = Math.max(10, Math.hypot(b.vx, b.vy) * 1.3);
            b.vx = nx * bounceSpeed;
            b.vy = ny * bounceSpeed;

            bumper.flash = 1;
            sound.playBumper();
            addScore(bumper.points, bumper.x, bumper.y - 18, '#f43f5e');
            advanceMission('bumpers');

            for (let i = 0; i < 10; i++) {
              particlesRef.current.push({
                x: b.x,
                y: b.y,
                vx: (Math.random() - 0.5) * 7,
                vy: (Math.random() - 0.5) * 7,
                color: '#f43f5e',
                alpha: 1,
                size: 3,
              });
            }
          }
        });

        // Slingshots (Electric Lightning Housings above Flippers)
        const checkSlingshot = (x1: number, y1: number, x2: number, y2: number, kx: number, ky: number) => {
          const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
          const t = Math.max(0, Math.min(1, ((b.x - x1) * (x2 - x1) + (b.y - y1) * (y2 - y1)) / l2));
          const px = x1 + t * (x2 - x1);
          const py = y1 + t * (y2 - y1);
          const dist = Math.hypot(b.x - px, b.y - py);
          if (dist < b.radius + 4) {
            b.vx = kx * 10;
            b.vy = ky * 10;
            sound.playBumper();
            addScore(250, px, py - 12, '#38bdf8');
            for (let i = 0; i < 8; i++) {
              particlesRef.current.push({
                x: px,
                y: py,
                vx: kx * 4 + (Math.random() - 0.5) * 4,
                vy: ky * 4 + (Math.random() - 0.5) * 4,
                color: '#38bdf8',
                alpha: 1,
                size: 2.5,
              });
            }
          }
        };

        checkSlingshot(78, 440, 112, 500, 1, -0.65); // Left Slingshot
        checkSlingshot(312, 440, 278, 500, -1, -0.65); // Right Slingshot

        // Guide walls leading to flippers
        const checkGuideWall = (x1: number, y1: number, x2: number, y2: number) => {
          const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
          const t = Math.max(0, Math.min(1, ((b.x - x1) * (x2 - x1) + (b.y - y1) * (y2 - y1)) / l2));
          const px = x1 + t * (x2 - x1);
          const py = y1 + t * (y2 - y1);
          const dist = Math.hypot(b.x - px, b.y - py);
          if (dist < b.radius + 3) {
            const nx = (b.x - px) / dist;
            const ny = (b.y - py) / dist;
            b.x = px + nx * (b.radius + 3);
            const dot = b.vx * nx + b.vy * ny;
            b.vx = (b.vx - 1.5 * dot * nx) * 0.8;
            b.vy = (b.vy - 1.5 * dot * ny) * 0.8;
          }
        };

        checkGuideWall(18, 470, 125, 535); // Left bottom inlane
        checkGuideWall(376, 470, 265, 535); // Right bottom inlane

        // Flipper Collision Routine
        const checkFlipper = (f: typeof lf, isLeft: boolean) => {
          const tipX = f.x + Math.cos(f.currentAngle) * f.length;
          const tipY = f.y + Math.sin(f.currentAngle) * f.length;

          const l2 = (tipX - f.x) ** 2 + (tipY - f.y) ** 2;
          const t = Math.max(0, Math.min(1, ((b.x - f.x) * (tipX - f.x) + (b.y - f.y) * (tipY - f.y)) / l2));
          const px = f.x + t * (tipX - f.x);
          const py = f.y + t * (tipY - f.y);
          const dist = Math.hypot(b.x - px, b.y - py);

          if (dist < b.radius + 5) {
            const nx = isLeft ? -Math.sin(f.currentAngle) : Math.sin(f.currentAngle);
            const ny = isLeft ? Math.cos(f.currentAngle) : -Math.cos(f.currentAngle);

            b.x = px - ny * (b.radius + 5);
            b.y = py + nx * (b.radius + 5);

            const swingForce = Math.abs(f.angularVelocity) * (15 + t * 18);
            if (f.isPressed && swingForce > 0.5) {
              b.vx = (isLeft ? 1 : -1) * (3.5 + t * 4);
              b.vy = -Math.max(11, swingForce);
              sound.playBumper();
              addScore(100, px, py - 10, '#38bdf8');
            } else {
              const dot = b.vx * nx + b.vy * ny;
              b.vx = (b.vx - 1.5 * dot * nx) * 0.7;
              b.vy = (b.vy - 1.5 * dot * ny) * 0.7;
            }
          }
        };

        checkFlipper(lf, true);
        checkFlipper(rf, false);

        // Drain Hole
        if (b.y > HEIGHT + 25) {
          sound.playGameOver();
          continue;
        }

        activeBalls.push(b);
      }

      ballsRef.current = activeBalls;

      // Handle All Balls Lost
      if (activeBalls.length === 0) {
        multiballActiveRef.current = false;
        setMultiballActive(false);
        setBallCount((curr) => {
          const next = curr - 1;
          if (next <= 0) {
            setGameState('GAMEOVER');
          } else {
            spawnBall();
          }
          return next;
        });
      }

      // 6. Floating Scores & Particles Update
      floatingScoresRef.current = floatingScoresRef.current
        .map((s) => ({ ...s, y: s.y - 0.75, alpha: s.alpha - 0.02 }))
        .filter((s) => s.alpha > 0);

      particlesRef.current = particlesRef.current
        .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, alpha: p.alpha - 0.028 }))
        .filter((p) => p.alpha > 0);
    };

    // Modern High-Gloss Visual Render
    const render = (c: CanvasRenderingContext2D) => {
      // 1. Dark Cosmic Gradient Background (matching reference image)
      const bgGrad = c.createLinearGradient(0, 0, 0, HEIGHT);
      bgGrad.addColorStop(0, '#0c102a');
      bgGrad.addColorStop(0.5, '#090d22');
      bgGrad.addColorStop(1, '#050713');
      c.fillStyle = bgGrad;
      c.fillRect(0, 0, WIDTH, HEIGHT);

      // 2. Soft Volumetric Lighting Blooms on rails and upper corners
      const drawGlow = (gx: number, gy: number, r: number, col: string) => {
        const glow = c.createRadialGradient(gx, gy, 0, gx, gy, r);
        glow.addColorStop(0, col);
        glow.addColorStop(1, 'transparent');
        c.fillStyle = glow;
        c.beginPath();
        c.arc(gx, gy, r, 0, Math.PI * 2);
        c.fill();
      };
      drawGlow(90, 80, 110, 'rgba(236, 72, 153, 0.08)');
      drawGlow(320, 85, 120, 'rgba(192, 132, 252, 0.1)');
      drawGlow(340, 280, 90, 'rgba(244, 63, 94, 0.08)');

      // 3. Intricate Cyan Lightning Veins across the table (spiderweb energy)
      c.save();
      c.strokeStyle = 'rgba(56, 189, 248, 0.22)';
      c.lineWidth = 1;
      const drawVein = (pts: [number, number][]) => {
        c.beginPath();
        c.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          c.lineTo(pts[i][0], pts[i][1]);
        }
        c.stroke();
      };
      drawVein([[210, 385], [170, 330], [130, 290], [105, 230], [80, 170]]);
      drawVein([[210, 385], [240, 340], [280, 310], [315, 250], [330, 180]]);
      drawVein([[210, 385], [200, 440], [180, 470], [140, 500]]);
      drawVein([[210, 385], [225, 440], [245, 470], [275, 500]]);
      drawVein([[170, 330], [195, 265]]);
      drawVein([[240, 340], [260, 265]]);
      c.restore();

      // 4. Central Energy Vortex (Wormhole Core with Concentric Dots & Radiating Spikes)
      const v = vortexRef.current;
      c.save();
      c.translate(v.x, v.y);
      c.rotate(v.rotation);

      // Outer Cyan Ring
      c.strokeStyle = '#0284c7';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, v.radius, 0, Math.PI * 2);
      c.stroke();

      // Concentric Cyan & Amber target dots
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        const dotR = v.radius - 8;
        c.fillStyle = i % 2 === 0 ? '#38bdf8' : '#f59e0b';
        c.beginPath();
        c.arc(Math.cos(ang) * dotR, Math.sin(ang) * dotR, 3, 0, Math.PI * 2);
        c.fill();
      }

      // Radiating energy spikes
      c.strokeStyle = 'rgba(34, 211, 238, 0.4)';
      c.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(Math.cos(ang) * (v.radius - 12), Math.sin(ang) * (v.radius - 12));
        c.stroke();
      }

      // Glowing Center Core
      c.shadowColor = '#06b6d4';
      c.shadowBlur = 15;
      c.fillStyle = '#22d3ee';
      c.beginPath();
      c.arc(0, 0, v.coreRadius, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = '#ef4444';
      c.beginPath();
      c.arc(0, 0, 4, 0, Math.PI * 2);
      c.fill();
      c.restore();

      // 5. Left Elevated Purple Curved Ramp with Chevron Directional Arrows (>>>)
      c.save();
      // Ramp translucent body
      c.strokeStyle = 'rgba(192, 132, 252, 0.4)';
      c.lineWidth = 14;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(95, 345);
      c.bezierCurveTo(75, 280, 75, 180, 135, 160);
      c.stroke();

      // Ramp outer metal rails
      c.strokeStyle = '#c084fc';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(88, 345);
      c.bezierCurveTo(68, 280, 68, 175, 130, 153);
      c.stroke();
      c.beginPath();
      c.moveTo(102, 345);
      c.bezierCurveTo(82, 280, 82, 185, 140, 167);
      c.stroke();

      // Glowing magenta chevron arrows inside ramp
      c.fillStyle = '#f43f5e';
      c.font = 'bold 11px monospace';
      c.textAlign = 'center';
      c.fillText('▲', 85, 300);
      c.fillText('▲', 82, 240);
      c.fillText('►', 105, 185);
      c.restore();

      // 6. Right Red/Orange Acceleration Ramp
      c.save();
      c.strokeStyle = 'rgba(249, 115, 22, 0.4)';
      c.lineWidth = 12;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(335, 300);
      c.lineTo(345, 190);
      c.stroke();

      c.strokeStyle = '#f97316';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(329, 300);
      c.lineTo(339, 190);
      c.stroke();
      c.beginPath();
      c.moveTo(341, 300);
      c.lineTo(351, 190);
      c.stroke();

      // Orange chevron indicator
      c.fillStyle = '#fbbf24';
      c.font = 'bold 10px monospace';
      c.textAlign = 'center';
      c.fillText('▲', 340, 260);
      c.fillText('▲', 345, 220);
      c.restore();

      // 7. Pop Bumpers (Matching reference image: concentric red/white caps with chrome ring)
      bumpersRef.current.forEach((b) => {
        c.save();
        // Glow shadow
        c.shadowColor = '#f43f5e';
        c.shadowBlur = b.flash > 0 ? 30 : 12;

        // Outer chrome ring
        c.fillStyle = '#cbd5e1';
        c.beginPath();
        c.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        c.fill();

        // Blue intermediate ring
        c.fillStyle = '#1e3a8a';
        c.beginPath();
        c.arc(b.x, b.y, b.radius * 0.88, 0, Math.PI * 2);
        c.fill();

        // White base
        c.fillStyle = b.flash > 0 ? '#ffffff' : '#f8fafc';
        c.beginPath();
        c.arc(b.x, b.y, b.radius * 0.72, 0, Math.PI * 2);
        c.fill();

        // Red central cap with concentric target dots
        c.fillStyle = '#dc2626';
        c.beginPath();
        c.arc(b.x, b.y, b.radius * 0.48, 0, Math.PI * 2);
        c.fill();

        c.fillStyle = '#38bdf8';
        c.beginPath();
        c.arc(b.x, b.y, 4, 0, Math.PI * 2);
        c.fill();
        c.restore();
      });

      // 8. Slingshots with Electric Lightning Graphic (Above Flippers)
      const renderSlingshot = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, isLeft: boolean) => {
        c.save();
        // Glass housing
        c.fillStyle = 'rgba(15, 23, 42, 0.8)';
        c.strokeStyle = '#38bdf8';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.lineTo(x3, y3);
        c.closePath();
        c.fill();
        c.stroke();

        // Electric lightning bolt decal inside slingshot
        c.strokeStyle = '#67e8f9';
        c.lineWidth = 2;
        c.shadowColor = '#38bdf8';
        c.shadowBlur = 8;
        const midX = isLeft ? 92 : 298;
        c.beginPath();
        c.moveTo(midX, 450);
        c.lineTo(midX + (isLeft ? 6 : -6), 465);
        c.lineTo(midX - (isLeft ? 4 : -4), 475);
        c.lineTo(midX + (isLeft ? 8 : -8), 490);
        c.stroke();
        c.restore();
      };
      renderSlingshot(78, 440, 112, 500, 78, 500, true);
      renderSlingshot(312, 440, 278, 500, 312, 500, false);

      // 9. Modern Cabinet Outer Rails & Metallic Borders
      c.save();
      c.strokeStyle = '#475569';
      c.lineWidth = 4;
      c.lineCap = 'round';

      // Left Table Wall
      c.beginPath();
      c.moveTo(18, 150);
      c.lineTo(18, 470);
      c.lineTo(125, 535);
      c.stroke();

      // Right Guide Wall
      c.beginPath();
      c.moveTo(376, 160);
      c.lineTo(376, 470);
      c.lineTo(265, 535);
      c.stroke();

      // Outer Shooter Lane Wall
      c.strokeStyle = '#64748b';
      c.beginPath();
      c.moveTo(408, 150);
      c.lineTo(408, 610);
      c.stroke();

      // Top Launch Arch
      c.beginPath();
      c.arc(205, 150, 190, Math.PI, 0, false);
      c.stroke();

      // Radiant Purple Speed Rays beneath the flippers towards drain
      c.fillStyle = '#701a75';
      c.beginPath();
      c.moveTo(195, 545);
      c.lineTo(210, 610);
      c.lineTo(180, 610);
      c.closePath();
      c.fill();

      c.fillStyle = '#86198f';
      c.beginPath();
      c.moveTo(210, 545);
      c.lineTo(225, 610);
      c.lineTo(195, 610);
      c.closePath();
      c.fill();
      c.restore();

      // 10. Modern Sleek Flippers (White rubber with red/orange bodies and chrome pivot)
      const renderModernFlipper = (f: typeof leftFlipperRef.current, isLeft: boolean) => {
        c.save();
        c.translate(f.x, f.y);
        c.rotate(f.currentAngle);

        // Flipper body
        c.fillStyle = f.isPressed ? '#ea580c' : '#c2410c';
        c.strokeStyle = '#f8fafc'; // White rubber edge!
        c.lineWidth = 3;
        c.beginPath();
        c.roundRect(0, -6, f.length, 12, 6);
        c.fill();
        c.stroke();

        // Chrome pivot cap
        c.fillStyle = '#e2e8f0';
        c.beginPath();
        c.arc(0, 0, 8, 0, Math.PI * 2);
        c.fill();

        c.fillStyle = '#0f172a';
        c.beginPath();
        c.arc(0, 0, 3, 0, Math.PI * 2);
        c.fill();
        c.restore();
      };
      renderModernFlipper(leftFlipperRef.current, true);
      renderModernFlipper(rightFlipperRef.current, false);

      // 11. Shooter Spring Plunger in lane
      c.save();
      const plungerY = 580 + plungerRef.current.tension * 25;
      c.strokeStyle = '#38bdf8';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(395, 620);
      for (let i = 0; i < 5; i++) {
        const sy = 620 - ((620 - plungerY) / 5) * i;
        c.lineTo(i % 2 === 0 ? 390 : 400, sy);
      }
      c.lineTo(395, plungerY);
      c.stroke();

      c.fillStyle = '#0284c7';
      c.fillRect(387, plungerY - 6, 16, 6);
      c.restore();

      // 12. Steel Balls with Electric Glowing Comet Tail
      ballsRef.current.forEach((b) => {
        // Draw trailing comet tail
        if (b.trail.length > 1) {
          c.save();
          for (let i = 0; i < b.trail.length - 1; i++) {
            const t1 = b.trail[i];
            const t2 = b.trail[i + 1];
            const alpha = (1 - i / b.trail.length) * 0.6;
            c.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
            c.lineWidth = b.radius * (1 - i / b.trail.length) * 1.5;
            c.lineCap = 'round';
            c.beginPath();
            c.moveTo(t1.x, t1.y);
            c.lineTo(t2.x, t2.y);
            c.stroke();
          }
          c.restore();
        }

        // Chrome Steel Ball with specular highlights
        c.save();
        const grad = c.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, b.radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, '#e2e8f0');
        grad.addColorStop(0.7, '#64748b');
        grad.addColorStop(1, '#0f172a');

        c.fillStyle = grad;
        c.shadowColor = '#38bdf8';
        c.shadowBlur = 10;
        c.beginPath();
        c.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        c.fill();
        c.restore();
      });

      // 13. Floating Score Text
      floatingScoresRef.current.forEach((s) => {
        c.save();
        c.globalAlpha = s.alpha;
        c.font = 'bold 12px monospace';
        c.fillStyle = s.color;
        c.textAlign = 'center';
        c.fillText(s.text, s.x, s.y);
        c.restore();
      });

      // 14. Particle Sparks
      particlesRef.current.forEach((p) => {
        c.save();
        c.globalAlpha = p.alpha;
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.fill();
        c.restore();
      });
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState, addScore, spawnBall, advanceMission]);

  const activeMission = MISSIONS[currentMissionIdx] || MISSIONS[0];

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto font-sans select-none">
      {/* MODERN SCI-FI TOP HUD (MATCHING REFERENCE IMAGE 1:1) */}
      <div className="w-full bg-[#050713] p-2.5 flex items-center justify-between gap-2 border-x border-t border-slate-800 rounded-t-2xl shadow-xl">
        {/* Left: Diamond Menu Icon */}
        <button
          type="button"
          onClick={() => setShowMenuModal(true)}
          className="w-10 h-10 shrink-0 rotate-45 rounded-lg bg-gradient-to-br from-cyan-900/60 to-slate-950 border-2 border-cyan-400/80 shadow-md shadow-cyan-500/20 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          title="Menu de Missões"
        >
          <div className="-rotate-45 text-cyan-300">
            <Menu className="w-5 h-5 stroke-[2.5]" />
          </div>
        </button>

        {/* Center: Mission Marquee Banner */}
        <div className="flex-1 bg-gradient-to-r from-slate-900 via-cyan-950/60 to-slate-900 border border-cyan-500/40 rounded-xl px-3 py-1 flex flex-col items-center justify-center text-center shadow-inner overflow-hidden">
          <span className="text-[10px] sm:text-[11px] font-sans text-cyan-300 tracking-wide truncate">
            {activeMission.sub}
          </span>
          <span className="text-xs sm:text-sm font-extrabold text-white tracking-wide truncate flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-cyan-400 fill-cyan-400 shrink-0" />
            <span>{activeMission.title}</span>
          </span>
        </div>

        {/* Right: Digital Score Box */}
        <div className="bg-[#0b0f24] border-2 border-slate-400/80 rounded-xl px-2.5 py-1 flex flex-col items-end min-w-[90px] shadow-md">
          <span className="text-[9px] font-mono text-slate-300 tracking-wider">SCORE</span>
          <span className="text-xs sm:text-sm font-black font-mono text-white tabular-nums tracking-wide">
            {score.toLocaleString('pt-BR')}
          </span>
        </div>

        {/* Far Right: Magenta / Neon Pink Ball Badge */}
        <div className="w-10 h-11 shrink-0 rounded-xl bg-gradient-to-b from-pink-500/30 to-pink-900/50 border-2 border-pink-400/90 shadow-md shadow-pink-500/20 flex flex-col items-center justify-center">
          <span className="text-[8px] font-mono font-bold text-pink-300 leading-none">BALL</span>
          <span className="text-sm font-black text-white leading-none mt-0.5">{ballCount}</span>
        </div>
      </div>

      {/* Main Table Viewport Canvas */}
      <div className="relative w-full aspect-[420/630] max-h-[630px] bg-[#050713] border-x border-slate-800 overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full h-full block"
        />

        {/* Direct Touch Tap Zones on Canvas (Mobile friendliness) */}
        <div className="absolute inset-0 flex pointer-events-auto">
          {/* Left Screen Tap -> Left Flipper */}
          <div
            className="w-1/2 h-full opacity-0 cursor-pointer"
            onPointerDown={handleLeftDown}
            onPointerUp={handleLeftUp}
            onPointerLeave={handleLeftUp}
          />
          {/* Right Screen Tap -> Right Flipper */}
          <div
            className="w-1/2 h-full opacity-0 cursor-pointer"
            onPointerDown={handleRightDown}
            onPointerUp={handleRightUp}
            onPointerLeave={handleRightUp}
          />
        </div>

        {/* Start Game Overlay */}
        {gameState === 'IDLE' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center mb-3 shadow-xl shadow-cyan-500/20">
              <Zap className="w-7 h-7 text-cyan-400 fill-cyan-400" />
            </div>
            <h3 className="text-2xl font-black text-white mb-1">Pinball Galáctico 3D</h3>
            <p className="text-xs text-cyan-300 font-mono mb-4 uppercase tracking-widest">
              Estilo Space Cadet & Arcades Modernos
            </p>
            <p className="text-xs text-slate-300 max-w-xs mb-6 leading-relaxed">
              Puxe o lançador de mola, entre na rampa roxa para ativar missões, acerte os bumpers de alta tensão e mergulhe no vórtice de hiperespaço!
            </p>
            <button
              onClick={resetGame}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm shadow-xl shadow-cyan-500/25 active:scale-95 transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Lançar Esfera de Aço!
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="text-pink-500 font-mono text-xs tracking-widest font-bold mb-1">
              FIM DE JOGO
            </div>
            <h3 className="text-2xl font-black text-white mb-2">Todas as Bolas Perdidas</h3>
            <p className="text-xs text-slate-300 mb-6 font-mono">
              Pontuação Final: <span className="text-cyan-400 font-bold">{score.toLocaleString('pt-BR')}</span>
            </p>
            <button
              onClick={resetGame}
              className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow-xl shadow-cyan-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Jogar Novamente
            </button>
          </div>
        )}
      </div>

      {/* Modern Controls Bar below table */}
      <div className="w-full bg-[#070914] border border-slate-800 rounded-b-2xl p-2.5 flex flex-col gap-2 shadow-2xl">
        <div className="grid grid-cols-3 gap-2 w-full">
          {/* Left Flipper */}
          <button
            type="button"
            onPointerDown={handleLeftDown}
            onPointerUp={handleLeftUp}
            onPointerLeave={handleLeftUp}
            className="py-3 rounded-xl bg-gradient-to-b from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 active:scale-95 text-white font-black text-xs shadow-lg shadow-orange-500/20 select-none flex flex-col items-center justify-center"
          >
            <span>PALHETA ESQ.</span>
            <span className="text-[9px] opacity-75 font-mono">(Z / A)</span>
          </button>

          {/* Plunger (Spring Trigger) */}
          <button
            type="button"
            onPointerDown={handlePlungerDown}
            onPointerUp={handlePlungerUp}
            onPointerLeave={handlePlungerUp}
            className={`py-3 rounded-xl border flex flex-col items-center justify-center select-none transition-all active:scale-95 ${
              plungerTension > 0
                ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-lg shadow-cyan-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <span className="font-extrabold text-xs">
              {plungerTension > 0 ? `SOLTAR (${Math.round(plungerTension * 100)}%)` : 'LANÇADOR'}
            </span>
            <span className="text-[9px] text-slate-400 font-mono">(Espaço)</span>
          </button>

          {/* Right Flipper */}
          <button
            type="button"
            onPointerDown={handleRightDown}
            onPointerUp={handleRightUp}
            onPointerLeave={handleRightUp}
            className="py-3 rounded-xl bg-gradient-to-b from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 active:scale-95 text-white font-black text-xs shadow-lg shadow-orange-500/20 select-none flex flex-col items-center justify-center"
          >
            <span>PALHETA DIR.</span>
            <span className="text-[9px] opacity-75 font-mono">(/ / D)</span>
          </button>
        </div>

        {/* Footer info & High Score */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-[11px]">
            <Trophy className="w-3.5 h-3.5" />
            <span>Recorde: {highScore.toLocaleString('pt-BR')}</span>
          </div>

          <span className="text-[10px] font-mono text-slate-400">
            Dica: Toque nos lados da mesa para acionar as palhetas
          </span>
        </div>
      </div>

      {/* Menu / Mission Modal */}
      {showMenuModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#0b0f24] border-2 border-cyan-500/60 rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3 border-b border-cyan-500/30 pb-2">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                Missões da Frota Galáctica
              </span>
              <button
                onClick={() => setShowMenuModal(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 mb-4">
              {MISSIONS.map((m, idx) => (
                <div
                  key={m.id}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                    idx === currentMissionIdx
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400'
                  }`}
                >
                  <div>
                    <div className="font-bold">{m.title}</div>
                    <div className="text-[10px] opacity-75">{m.sub}</div>
                  </div>
                  <span className="font-mono text-amber-400 font-bold">+{m.points.toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowMenuModal(false)}
              className="w-full py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
            >
              Continuar Jogando
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
