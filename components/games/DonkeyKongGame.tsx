'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Trophy, Heart, Sparkles, Flame } from 'lucide-react';
import { sound } from '@/lib/sound';
import { getHighScore, saveHighScore } from '@/lib/gameStore';
import { VirtualController } from '../VirtualController';

interface Ladder {
  x: number;
  topY: number;
  bottomY: number;
  broken?: boolean;
}

interface Girder {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Barrel {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  onLadder: boolean;
  jumpedOver: boolean;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  alpha: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
}

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 520;

// Girders (Steel beams)
// Level 0: Ground (y ~ 480)
// Level 1: slopes slightly down to left (y 405 -> 420)
// Level 2: slopes slightly down to right (y 330 -> 345)
// Level 3: slopes slightly down to left (y 250 -> 265)
// Level 4: Kong's girder (y 170 -> 180)
// Level 5: Pauline's goal platform at top center (y 95)
const GIRDERS: Girder[] = [
  // Bottom ground
  { x1: 20, y1: 490, x2: 460, y2: 490 },
  // 1st tier (slopes to left: rolls left)
  { x1: 20, y1: 420, x2: 420, y2: 400 },
  // 2nd tier (slopes to right: rolls right)
  { x1: 60, y1: 325, x2: 460, y2: 345 },
  // 3rd tier (slopes to left: rolls left)
  { x1: 20, y1: 265, x2: 420, y2: 245 },
  // 4th tier (Kong tier)
  { x1: 40, y1: 170, x2: 360, y2: 170 },
  // Top goal platform (Pauline)
  { x1: 200, y1: 95, x2: 320, y2: 95 },
];

const LADDERS: Ladder[] = [
  // Ground to Tier 1
  { x: 380, topY: 402, bottomY: 490 },
  { x: 160, topY: 414, bottomY: 490, broken: true },
  // Tier 1 to Tier 2
  { x: 100, topY: 327, bottomY: 416 },
  { x: 260, topY: 337, bottomY: 407, broken: true },
  // Tier 2 to Tier 3
  { x: 380, topY: 247, bottomY: 341 },
  { x: 200, topY: 256, bottomY: 334, broken: true },
  // Tier 3 to Tier 4
  { x: 120, topY: 170, bottomY: 260 },
  // Tier 4 to Top Goal
  { x: 230, topY: 95, bottomY: 170 },
];

function getGirderYAt(x: number, girder: Girder): number {
  const ratio = (x - girder.x1) / (girder.x2 - girder.x1);
  return girder.y1 + ratio * (girder.y2 - girder.y1);
}

function findPlatformY(x: number, currentY: number): { y: number; girder: Girder } | null {
  for (const g of GIRDERS) {
    if (x >= Math.min(g.x1, g.x2) - 10 && x <= Math.max(g.x1, g.x2) + 10) {
      const gY = getGirderYAt(x, g);
      // If player foot is near platform top (within falling range)
      if (currentY <= gY + 8 && currentY >= gY - 26) {
        return { y: gY, girder: g };
      }
    }
  }
  return null;
}

export function DonkeyKongGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'VICTORY'>('IDLE');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => getHighScore('donkey_kong'));
  const [lives, setLives] = useState(3);
  const [bonusTimer, setBonusTimer] = useState(5000);
  const [hammerActive, setHammerActive] = useState(false);

  // Mutable Game References
  const playerRef = useRef({
    x: 50,
    y: 490,
    vx: 0,
    vy: 0,
    isGrounded: true,
    isClimbing: false,
    facingLeft: false,
    frame: 0,
    hammerTime: 0,
  });

  const barrelsRef = useRef<Barrel[]>([]);
  const barrelIdCounterRef = useRef(1);
  const nextBarrelSpawnTimeRef = useRef(0);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const hammerItemRef = useRef<{ x: number; y: number; available: boolean }>({
    x: 80,
    y: 320,
    available: true,
  });

  const kongFrameRef = useRef(0);
  const keysPressedRef = useRef<Record<string, boolean>>({});
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  const resetHeroPosition = useCallback(() => {
    playerRef.current.x = 50;
    playerRef.current.y = 490;
    playerRef.current.vx = 0;
    playerRef.current.vy = 0;
    playerRef.current.isGrounded = true;
    playerRef.current.isClimbing = false;
    playerRef.current.hammerTime = 0;
    setHammerActive(false);
  }, []);

  const resetGame = useCallback(() => {
    resetHeroPosition();
    barrelsRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    hammerItemRef.current = { x: 80, y: 320, available: true };
    nextBarrelSpawnTimeRef.current = 100;
    setScore(0);
    setBonusTimer(5000);
    setLives(3);
    setGameState('PLAYING');
    sound.playClick();
  }, [resetHeroPosition]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      keysPressedRef.current[e.key] = true;

      // Jump action
      if (e.key === ' ' || e.key === 'Spacebar') {
        const p = playerRef.current;
        if (p.isGrounded && !p.isClimbing) {
          p.vy = -6.5;
          p.isGrounded = false;
          sound.playJump();
        }
      }

      if (e.key === 'p' || e.key === 'P') {
        setGameState((s) => (s === 'PLAYING' ? 'PAUSED' : s === 'PAUSED' ? 'PLAYING' : s));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main 60 FPS Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min(32, timestamp - lastTimeRef.current);
      lastTimeRef.current = timestamp;

      if (gameState === 'PLAYING') {
        updateGame(dt);
      }

      renderGame(ctx);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    const updateGame = (dt: number) => {
      const p = playerRef.current;
      const keys = keysPressedRef.current;

      // Decrement bonus timer slowly
      setBonusTimer((b) => Math.max(0, b - 1));

      // Check Hammer Active timer
      if (p.hammerTime > 0) {
        p.hammerTime -= dt;
        if (p.hammerTime <= 0) {
          p.hammerTime = 0;
          setHammerActive(false);
        } else {
          setHammerActive(true);
        }
      }

      // Check ladder interaction
      let nearbyLadder: Ladder | null = null;
      for (const l of LADDERS) {
        if (!l.broken && Math.abs(p.x - l.x) < 14 && p.y <= l.bottomY + 5 && p.y >= l.topY - 8) {
          nearbyLadder = l;
          break;
        }
      }

      const moveLeft = keys['ArrowLeft'] || keys['a'] || keys['A'];
      const moveRight = keys['ArrowRight'] || keys['d'] || keys['D'];
      const moveUp = keys['ArrowUp'] || keys['w'] || keys['W'];
      const moveDown = keys['ArrowDown'] || keys['s'] || keys['S'];

      // Climbing logic
      if (nearbyLadder && (moveUp || moveDown)) {
        p.isClimbing = true;
        p.x = nearbyLadder.x; // snap to ladder center
        p.vx = 0;
        if (moveUp && p.y > nearbyLadder.topY) {
          p.y -= 2.2;
          p.frame += 0.2;
          sound.playMove();
        } else if (moveDown && p.y < nearbyLadder.bottomY) {
          p.y += 2.2;
          p.frame += 0.2;
          sound.playMove();
        }

        // Ladder exit check
        if (p.y <= nearbyLadder.topY) {
          p.y = nearbyLadder.topY;
          p.isClimbing = false;
          p.isGrounded = true;
        } else if (p.y >= nearbyLadder.bottomY) {
          p.y = nearbyLadder.bottomY;
          p.isClimbing = false;
          p.isGrounded = true;
        }
      } else if (!nearbyLadder) {
        p.isClimbing = false;
      }

      // Horizontal movement if not locked in climbing
      if (!p.isClimbing) {
        const speed = p.hammerTime > 0 ? 3.0 : 2.5;
        if (moveLeft) {
          p.vx = -speed;
          p.facingLeft = true;
          p.frame += 0.25;
        } else if (moveRight) {
          p.vx = speed;
          p.facingLeft = false;
          p.frame += 0.25;
        } else {
          p.vx = 0;
        }

        p.x += p.vx;
        p.x = Math.max(25, Math.min(CANVAS_WIDTH - 25, p.x));

        // Gravity & Vertical physics
        if (!p.isGrounded) {
          p.vy += 0.32; // Gravity
          p.y += p.vy;
        }

        // Platform collision detection
        const plat = findPlatformY(p.x, p.y);
        if (plat && p.vy >= 0) {
          p.y = plat.y;
          p.vy = 0;
          p.isGrounded = true;
        } else if (!plat && !p.isClimbing) {
          p.isGrounded = false;
        }
      }

      // Check Hammer Item Pickup
      const hammer = hammerItemRef.current;
      if (hammer.available && Math.abs(p.x - hammer.x) < 20 && Math.abs(p.y - hammer.y) < 20) {
        hammer.available = false;
        p.hammerTime = 10000; // 10 seconds
        sound.playEat();
        floatingTextsRef.current.push({
          id: Date.now(),
          x: hammer.x,
          y: hammer.y - 10,
          text: 'MARTELO!',
          alpha: 1,
          color: '#fbbf24',
        });
      }

      // Spawn Barrels from Kong
      nextBarrelSpawnTimeRef.current -= 1;
      if (nextBarrelSpawnTimeRef.current <= 0) {
        nextBarrelSpawnTimeRef.current = 140 + Math.floor(Math.random() * 60); // every ~2.5 - 3.5 seconds
        kongFrameRef.current = 1; // Thump chest animation

        barrelsRef.current.push({
          id: barrelIdCounterRef.current++,
          x: 100,
          y: 162,
          vx: 2.2,
          vy: 0,
          angle: 0,
          onLadder: false,
          jumpedOver: false,
        });
        sound.playBounce();
      } else if (nextBarrelSpawnTimeRef.current % 30 === 0) {
        kongFrameRef.current = 0;
      }

      // Update Barrels
      const remainingBarrels: Barrel[] = [];
      for (const b of barrelsRef.current) {
        b.x += b.vx;
        b.angle += b.vx * 0.1;

        // Platform detection for barrels
        const bPlat = findPlatformY(b.x, b.y);
        if (bPlat) {
          b.y = bPlat.y - 8;
          b.vy = 0;

          // Follow slope of girder
          if (bPlat.girder.x1 < bPlat.girder.x2) {
            const slope = (bPlat.girder.y2 - bPlat.girder.y1) / (bPlat.girder.x2 - bPlat.girder.x1);
            if (slope > 0.01) {
              b.vx = Math.abs(b.vx); // roll right down slope
            } else if (slope < -0.01) {
              b.vx = -Math.abs(b.vx); // roll left down slope
            }
          }

          // Small chance to drop down a ladder (25%)
          if (!b.onLadder && Math.random() < 0.008) {
            for (const l of LADDERS) {
              if (!l.broken && Math.abs(b.x - l.x) < 8 && b.y <= l.topY + 6 && b.y >= l.topY - 14) {
                b.onLadder = true;
                b.vx = 0;
                b.vy = 3;
                break;
              }
            }
          }
        } else {
          // In air falling down to lower girder
          b.vy += 0.35;
          b.y += b.vy;
        }

        // Ground fire barrel at bottom left
        if (b.x <= 35 && b.y >= 480) {
          // Barrel falls into fire barrel
          sound.playBounce();
          for (let i = 0; i < 6; i++) {
            particlesRef.current.push({
              x: 35,
              y: 475,
              vx: (Math.random() - 0.5) * 3,
              vy: -Math.random() * 4,
              color: '#f97316',
              alpha: 1,
            });
          }
          continue; // Barrel consumed
        }

        // Jump over barrel check (+100 pts)
        if (!b.jumpedOver && !p.isGrounded && Math.abs(p.x - b.x) < 18 && p.y < b.y && p.y > b.y - 45) {
          b.jumpedOver = true;
          sound.playEat();
          const bonusPts = 100;
          setScore((s) => {
            const n = s + bonusPts;
            saveHighScore('donkey_kong', n);
            return n;
          });
          floatingTextsRef.current.push({
            id: Date.now() + Math.random(),
            x: b.x,
            y: b.y - 20,
            text: '+100',
            alpha: 1,
            color: '#22c55e',
          });
        }

        // Barrel collision with Hero
        const distToHero = Math.hypot(p.x - b.x, p.y - 12 - b.y);
        if (distToHero < 20) {
          if (p.hammerTime > 0) {
            // Smash barrel with hammer!
            sound.playHammer();
            for (let i = 0; i < 10; i++) {
              particlesRef.current.push({
                x: b.x,
                y: b.y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                color: '#d97706',
                alpha: 1,
              });
            }
            floatingTextsRef.current.push({
              id: Date.now() + Math.random(),
              x: b.x,
              y: b.y - 20,
              text: '+300',
              alpha: 1,
              color: '#eab308',
            });
            setScore((s) => {
              const n = s + 300;
              saveHighScore('donkey_kong', n);
              return n;
            });
            continue; // Barrel destroyed!
          } else {
            // Hero hit by barrel -> Lose Life!
            sound.playExplosion();
            setLives((l) => {
              const nextLives = l - 1;
              if (nextLives <= 0) {
                sound.playGameOver();
                setGameState('GAMEOVER');
              } else {
                resetHeroPosition();
              }
              return nextLives;
            });
            break;
          }
        }

        remainingBarrels.push(b);
      }
      barrelsRef.current = remainingBarrels;

      // Victory Condition: Reaching Pauline at top platform (x: 200..320, y <= 105)
      if (p.x >= 210 && p.x <= 310 && p.y <= 105) {
        sound.playClear();
        const stageClearBonus = bonusTimer + 1000;
        setScore((s) => {
          const n = s + stageClearBonus;
          saveHighScore('donkey_kong', n);
          return n;
        });
        setGameState('VICTORY');
      }

      // Update Floating texts
      floatingTextsRef.current = floatingTextsRef.current
        .map((t) => ({ ...t, y: t.y - 0.6, alpha: t.alpha - 0.02 }))
        .filter((t) => t.alpha > 0);

      // Update Particles
      particlesRef.current = particlesRef.current
        .map((pt) => ({ ...pt, x: pt.x + pt.vx, y: pt.y + pt.vy, alpha: pt.alpha - 0.03 }))
        .filter((pt) => pt.alpha > 0);
    };

    const renderGame = (c: CanvasRenderingContext2D) => {
      // Clear Screen
      c.fillStyle = '#060913';
      c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Girders (Steel Beams in Retro Magenta / Red)
      GIRDERS.forEach((g) => {
        c.save();
        c.strokeStyle = '#e11d48'; // iconic red-pink girder
        c.lineWidth = 8;
        c.beginPath();
        c.moveTo(g.x1, g.y1);
        c.lineTo(g.x2, g.y2);
        c.stroke();

        // Cross truss girder lattice
        c.strokeStyle = '#9f1239';
        c.lineWidth = 2;
        const dist = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
        const steps = Math.floor(dist / 14);
        for (let i = 0; i < steps; i++) {
          const r1 = i / steps;
          const r2 = (i + 1) / steps;
          const px1 = g.x1 + r1 * (g.x2 - g.x1);
          const py1 = g.y1 + r1 * (g.y2 - g.y1);
          const px2 = g.x1 + r2 * (g.x2 - g.x1);
          const py2 = g.y1 + r2 * (g.y2 - g.y1);
          c.beginPath();
          c.moveTo(px1, py1 + 4);
          c.lineTo(px2, py2 - 4);
          c.stroke();
        }
        c.restore();
      });

      // Draw Ladders (Cyan / Light Blue)
      LADDERS.forEach((l) => {
        c.save();
        c.strokeStyle = l.broken ? '#0284c7' : '#38bdf8';
        c.lineWidth = 2;
        // Two vertical rails
        c.beginPath();
        c.moveTo(l.x - 8, l.topY);
        c.lineTo(l.x - 8, l.bottomY);
        c.moveTo(l.x + 8, l.topY);
        c.lineTo(l.x + 8, l.bottomY);
        c.stroke();

        // Rungs
        const rungs = Math.floor((l.bottomY - l.topY) / 10);
        for (let i = 0; i <= rungs; i++) {
          if (l.broken && i > rungs / 2 - 2 && i < rungs / 2 + 2) continue; // broken gap
          const ry = l.topY + i * 10;
          c.beginPath();
          c.moveTo(l.x - 8, ry);
          c.lineTo(l.x + 8, ry);
          c.stroke();
        }
        c.restore();
      });

      // Draw Oil Barrel Fire Drum (Bottom Left)
      c.save();
      c.fillStyle = '#1e293b';
      c.fillRect(18, 464, 28, 26);
      c.fillStyle = '#334155';
      c.fillRect(16, 462, 32, 4);
      c.fillRect(16, 488, 32, 3);
      // Animated Fire Flames
      const flameH = 8 + Math.sin(Date.now() * 0.02) * 4;
      c.fillStyle = '#f97316';
      c.beginPath();
      c.moveTo(22, 462);
      c.lineTo(32, 462 - flameH);
      c.lineTo(42, 462);
      c.fill();
      c.fillStyle = '#facc15';
      c.beginPath();
      c.moveTo(26, 462);
      c.lineTo(32, 462 - flameH * 0.6);
      c.lineTo(38, 462);
      c.fill();
      c.restore();

      // Draw Hammer Item (if available)
      const hammer = hammerItemRef.current;
      if (hammer.available) {
        c.save();
        c.fillStyle = '#f59e0b';
        c.fillRect(hammer.x - 4, hammer.y - 14, 8, 6); // head
        c.fillStyle = '#78350f';
        c.fillRect(hammer.x - 2, hammer.y - 8, 4, 10); // handle
        c.restore();
      }

      // Draw Pauline (Top Goal)
      c.save();
      const paulineX = 260;
      const paulineY = 74;
      // Pink dress
      c.fillStyle = '#ec4899';
      c.fillRect(paulineX - 6, paulineY + 6, 12, 14);
      // Blonde Hair & Face
      c.fillStyle = '#fde047';
      c.fillRect(paulineX - 7, paulineY - 2, 14, 8);
      c.fillStyle = '#fed7aa';
      c.fillRect(paulineX - 4, paulineY + 2, 8, 6);
      // "AJUDA!" speech bubble with pulsing heart
      c.font = 'bold 9px monospace';
      c.fillStyle = '#f43f5e';
      c.fillText('♥ AJUDA! ♥', paulineX - 22, paulineY - 8);
      c.restore();

      // Draw Giant Kong (Top Left)
      c.save();
      const kongX = 90;
      const kongY = 125;
      c.fillStyle = '#78350f'; // brown fur
      // Body
      c.fillRect(kongX - 22, kongY - 10, 44, 45);
      // Head
      c.fillRect(kongX - 16, kongY - 32, 32, 24);
      // Chest
      c.fillStyle = '#b45309';
      c.fillRect(kongX - 12, kongY - 4, 24, 28);
      // Face / Eyes / Snout
      c.fillStyle = '#fbbf24';
      c.fillRect(kongX - 10, kongY - 24, 20, 12);
      c.fillStyle = '#000000';
      c.fillRect(kongX - 6, kongY - 22, 3, 3);
      c.fillRect(kongX + 3, kongY - 22, 3, 3);
      // Arms (chest thumping or rolling)
      c.fillStyle = '#78350f';
      if (kongFrameRef.current === 1) {
        // Thumping chest
        c.fillRect(kongX - 32, kongY - 12, 12, 24);
        c.fillRect(kongX + 20, kongY - 12, 12, 24);
      } else {
        // Normal arms down
        c.fillRect(kongX - 34, kongY, 14, 26);
        c.fillRect(kongX + 20, kongY, 14, 26);
      }
      // Barrel stack next to Kong
      c.fillStyle = '#92400e';
      c.fillRect(40, 134, 16, 26);
      c.fillRect(40, 104, 16, 26);
      c.restore();

      // Draw Barrels
      barrelsRef.current.forEach((b) => {
        c.save();
        c.translate(b.x, b.y);
        c.rotate(b.angle);
        c.fillStyle = '#b45309';
        c.beginPath();
        c.arc(0, 0, 8, 0, Math.PI * 2);
        c.fill();
        // Barrel steel rims
        c.strokeStyle = '#451a03';
        c.lineWidth = 2;
        c.stroke();
        c.beginPath();
        c.moveTo(-6, -4);
        c.lineTo(6, -4);
        c.moveTo(-6, 4);
        c.lineTo(6, 4);
        c.stroke();
        c.restore();
      });

      // Draw Hero (Jumpman / Mário style)
      const p = playerRef.current;
      c.save();
      c.translate(p.x, p.y);
      if (p.facingLeft) c.scale(-1, 1);

      // Hat & Cap (Red)
      c.fillStyle = '#dc2626';
      c.fillRect(-6, -24, 13, 5);
      c.fillRect(-4, -26, 8, 3);

      // Face & Nose
      c.fillStyle = '#fed7aa';
      c.fillRect(-4, -19, 9, 6);
      // Mustache
      c.fillStyle = '#451a03';
      c.fillRect(1, -16, 5, 2);

      // Shirt (Red) & Overalls (Blue)
      c.fillStyle = '#dc2626';
      c.fillRect(-6, -13, 12, 6);
      c.fillStyle = '#2563eb';
      c.fillRect(-5, -7, 10, 8);

      // Legs / Boots
      const walkCycle = Math.floor(p.frame) % 2;
      c.fillStyle = '#78350f';
      if (!p.isGrounded) {
        // Jumping legs
        c.fillRect(-7, 1, 5, 4);
        c.fillRect(2, -1, 5, 4);
      } else if (p.vx !== 0) {
        c.fillRect(walkCycle ? -6 : -4, 1, 4, 5);
        c.fillRect(walkCycle ? 2 : 0, 1, 4, 5);
      } else {
        c.fillRect(-6, 1, 5, 5);
        c.fillRect(1, 1, 5, 5);
      }

      // Draw Hammer in hand (if active)
      if (p.hammerTime > 0) {
        const swingUp = Math.floor(Date.now() / 120) % 2 === 0;
        c.fillStyle = '#f59e0b';
        if (swingUp) {
          c.fillRect(2, -36, 14, 8); // hammer head up
          c.fillStyle = '#78350f';
          c.fillRect(6, -28, 4, 16); // handle
        } else {
          c.fillRect(12, -8, 14, 8); // hammer head forward
          c.fillStyle = '#78350f';
          c.fillRect(4, -6, 12, 4); // handle
        }
      }
      c.restore();

      // Draw Floating Text Popups
      floatingTextsRef.current.forEach((t) => {
        c.save();
        c.globalAlpha = t.alpha;
        c.font = 'bold 12px monospace';
        c.fillStyle = t.color;
        c.textAlign = 'center';
        c.fillText(t.text, t.x, t.y);
        c.restore();
      });

      // Draw Particles
      particlesRef.current.forEach((pt) => {
        c.save();
        c.globalAlpha = pt.alpha;
        c.fillStyle = pt.color;
        c.fillRect(pt.x, pt.y, 4, 4);
        c.restore();
      });
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState, resetHeroPosition, bonusTimer]);

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto">
      {/* Top HUD */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/90 border border-slate-800 rounded-t-xl text-xs font-mono">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-400">PONTOS:</span>{' '}
            <span className="text-lg font-bold text-orange-400 tabular-nums">{score}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400 mr-1">VIDAS:</span>
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart
                key={i}
                className={`w-3.5 h-3.5 ${
                  i < lives ? 'text-red-500 fill-red-500' : 'text-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/40 border border-amber-800/40 rounded text-amber-400 font-bold">
            <span className="text-[10px] text-slate-400">BÔNUS:</span>
            <span className="tabular-nums">{bonusTimer}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/30 px-2.5 py-1 rounded border border-amber-800/40">
            <Trophy className="w-3.5 h-3.5" />
            <span className="font-bold tabular-nums">{highScore}</span>
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative w-full aspect-[480/520] max-h-[520px] bg-slate-950 border-x border-slate-800 overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full block"
        />

        {/* Hammer Active Indicator */}
        {hammerActive && (
          <div className="absolute top-3 left-3 bg-amber-500/20 border border-amber-500/60 px-2.5 py-1 rounded text-amber-300 font-mono text-[11px] font-bold animate-pulse flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>MARTELO ATIVO!</span>
          </div>
        )}

        {/* Start Overlay */}
        {gameState === 'IDLE' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-3 shadow-lg shadow-orange-500/10">
              <Flame className="w-8 h-8 text-orange-400 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Gorila Barris (Kong)</h3>
            <p className="text-xs text-slate-400 max-w-xs mb-5 leading-relaxed">
              Suba as vigas pelas escadas, salte sobre os barris arremessados (+100 pts), pegue o martelo (+300 pts) e alcance o topo para salvar a princesa!
            </p>
            <button
              onClick={resetGame}
              className="px-6 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-sm shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Subir e Jogar
            </button>
          </div>
        )}

        {/* Paused Overlay */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <h3 className="text-2xl font-bold text-amber-400 mb-2">JOGO PAUSADO</h3>
            <button
              onClick={() => setGameState('PLAYING')}
              className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm flex items-center gap-2 border border-slate-700 transition-colors"
            >
              <Play className="w-4 h-4 fill-current" />
              Continuar
            </button>
          </div>
        )}

        {/* Victory Overlay */}
        {gameState === 'VICTORY' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="text-emerald-400 font-mono text-sm tracking-widest font-bold mb-1">VOCÊ VENCEU!</div>
            <h3 className="text-3xl font-black text-white mb-2">Princesa Salva!</h3>
            <p className="text-xs text-slate-300 mb-5 font-mono">
              Pontuação com Bônus: {score}
            </p>
            <button
              onClick={resetGame}
              className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Jogar Novamente
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="text-red-500 font-mono text-sm tracking-widest font-bold mb-1">FIM DE JOGO</div>
            <h3 className="text-3xl font-black text-white mb-2">Os Barris Te Pegaram!</h3>
            <p className="text-xs text-slate-400 mb-5 font-mono">Pontos alcançados: {score}</p>
            <button
              onClick={resetGame}
              className="px-6 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-sm shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Tentar Novamente
            </button>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-b-xl p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (gameState === 'PLAYING') setGameState('PAUSED');
                else if (gameState === 'PAUSED') setGameState('PLAYING');
              }}
              disabled={gameState === 'IDLE' || gameState === 'GAMEOVER' || gameState === 'VICTORY'}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded font-medium flex items-center gap-1.5 transition-colors"
            >
              {gameState === 'PAUSED' ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
              {gameState === 'PAUSED' ? 'Retomar' : 'Pausar'}
            </button>

            <button
              onClick={resetGame}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reiniciar
            </button>
          </div>

          <span className="hidden sm:inline font-mono text-[11px]">
            Setas/WASD: Mover/Escalar · Espaço: Pular
          </span>
        </div>

        {/* Mobile touch virtual controller */}
        <VirtualController
          onDirection={(dir) => {
            const p = playerRef.current;
            if (dir === 'LEFT') {
              p.vx = -3;
              p.facingLeft = true;
              p.frame += 0.3;
              p.x = Math.max(25, p.x - 18);
            }
            if (dir === 'RIGHT') {
              p.vx = 3;
              p.facingLeft = false;
              p.frame += 0.3;
              p.x = Math.min(CANVAS_WIDTH - 25, p.x + 18);
            }
            if (dir === 'UP') {
              for (const l of LADDERS) {
                if (!l.broken && Math.abs(p.x - l.x) < 20 && p.y <= l.bottomY + 10 && p.y >= l.topY - 10) {
                  p.isClimbing = true;
                  p.x = l.x;
                  p.y = Math.max(l.topY, p.y - 18);
                  sound.playMove();
                  break;
                }
              }
            }
            if (dir === 'DOWN') {
              for (const l of LADDERS) {
                if (!l.broken && Math.abs(p.x - l.x) < 20 && p.y <= l.bottomY + 10 && p.y >= l.topY - 10) {
                  p.isClimbing = true;
                  p.x = l.x;
                  p.y = Math.min(l.bottomY, p.y + 18);
                  sound.playMove();
                  break;
                }
              }
            }
          }}
          onActionA={() => {
            const p = playerRef.current;
            if (p.isGrounded && !p.isClimbing) {
              p.vy = -6.5;
              p.isGrounded = false;
              sound.playJump();
            }
          }}
          actionALabel="PULAR"
        />
      </div>
    </div>
  );
}
