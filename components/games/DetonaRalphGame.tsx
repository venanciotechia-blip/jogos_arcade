'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Trophy, Award, Zap, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';
import { sound } from '@/lib/sound';
import { getHighScore, saveHighScore } from '@/lib/gameStore';
import { awardAuraWin, triggerDefeat } from '@/lib/auraStore';

// Dimensions
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 520;

// Grid layout: 4 floors, 4 columns of windows = 16 windows
const COLS = 4;
const ROWS = 4;

const WINDOW_WIDTH = 58;
const WINDOW_HEIGHT = 68;
const START_X = 72;
const START_Y = 175;
const GAP_X = 28;
const GAP_Y = 16;

type WindowState = 'FIXED' | 'CRACKED' | 'BROKEN';

interface BuildingWindow {
  col: number;
  row: number;
  x: number;
  y: number;
  state: WindowState;
  hasShutter: boolean;
  hasPie: boolean;
}

interface FallingBrick {
  id: number;
  x: number;
  y: number;
  vy: number;
  vx: number;
  rotation: number;
  vRot: number;
}

interface FlyingPigeon {
  id: number;
  x: number;
  y: number;
  vx: number;
  wingTimer: number;
}

interface SparkleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
}

export function DetonaRalphGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Game state
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'STAGE_CLEAR' | 'GAMEOVER'>('IDLE');
  const [stage, setStage] = useState(1);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => getHighScore('detona_ralph'));
  const [lives, setLives] = useState(3);
  const [invincibleTime, setInvincibleTime] = useState(0); // super pie timer
  const [statusMessage, setStatusMessage] = useState('Edifício Niceland - 1982');

  // Animation & Gameplay References
  const animFrameRef = useRef<number | null>(null);
  const windowsRef = useRef<BuildingWindow[]>([]);
  const bricksRef = useRef<FallingBrick[]>([]);
  const pigeonsRef = useRef<FlyingPigeon[]>([]);
  const particlesRef = useRef<SparkleParticle[]>([]);

  // Felix state
  const felixRef = useRef({
    col: 1,
    row: 3, // starts at bottom floor
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    isHammering: false,
    hammerTimer: 0,
    facing: 'RIGHT' as 'LEFT' | 'RIGHT',
    isJumping: false,
    jumpTimer: 0,
    isHurt: false,
    hurtTimer: 0,
  });

  // Ralph state
  const ralphRef = useRef({
    x: 200,
    targetX: 200,
    y: 85,
    state: 'IDLE' as 'IDLE' | 'STOMPING' | 'THROWING' | 'MAD',
    stateTimer: 0,
    nextActionTime: 0,
    facing: 'RIGHT' as 'LEFT' | 'RIGHT',
  });

  const screenShakeRef = useRef(0);
  const nextPieTimeRef = useRef(0);
  const nextPigeonTimeRef = useRef(0);
  const nextRalphAttackRef = useRef(0);

  // Initialize Windows for Stage
  const initWindows = useCallback((currentStage: number) => {
    const list: BuildingWindow[] = [];
    const brokenRate = Math.min(0.85, 0.45 + currentStage * 0.1);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const wx = START_X + c * (WINDOW_WIDTH + GAP_X);
        const wy = START_Y + r * (WINDOW_HEIGHT + GAP_Y);

        let state: WindowState = 'FIXED';
        if (Math.random() < brokenRate) {
          state = Math.random() < 0.5 ? 'CRACKED' : 'BROKEN';
        }

        // Window shutters in later stages (blocks standing/jumping)
        const hasShutter = currentStage >= 2 && Math.random() < 0.18 && !(c === 1 && r === 3);

        list.push({
          col: c,
          row: r,
          x: wx,
          y: wy,
          state,
          hasShutter,
          hasPie: false,
        });
      }
    }

    // Ensure at least 5 windows are broken
    const brokenCount = list.filter((w) => w.state !== 'FIXED').length;
    if (brokenCount < 5) {
      for (let i = 0; i < 5 - brokenCount; i++) {
        const eligible = list.filter((w) => w.state === 'FIXED');
        if (eligible.length > 0) {
          const randWin = eligible[Math.floor(Math.random() * eligible.length)];
          randWin.state = 'BROKEN';
        }
      }
    }

    windowsRef.current = list;
  }, []);

  // Position Felix at a specific window
  const setFelixPosition = useCallback((col: number, row: number, instant = false) => {
    const wx = START_X + col * (WINDOW_WIDTH + GAP_X) + WINDOW_WIDTH / 2;
    const wy = START_Y + row * (WINDOW_HEIGHT + GAP_Y) + WINDOW_HEIGHT - 6;

    felixRef.current.col = col;
    felixRef.current.row = row;
    felixRef.current.targetX = wx;
    felixRef.current.targetY = wy;

    if (instant) {
      felixRef.current.x = wx;
      felixRef.current.y = wy;
    }
  }, []);

  // Start new stage or game
  const startGame = useCallback((newStage = 1, resetScore = true) => {
    setStage(newStage);
    if (resetScore) {
      setScore(0);
      setLives(3);
    }
    setInvincibleTime(0);
    bricksRef.current = [];
    pigeonsRef.current = [];
    particlesRef.current = [];
    screenShakeRef.current = 0;

    initWindows(newStage);
    setFelixPosition(1, ROWS - 1, true);

    ralphRef.current = {
      x: 180,
      targetX: 180,
      y: 92,
      state: 'STOMPING',
      stateTimer: 40,
      nextActionTime: 0,
      facing: 'LEFT',
    };

    setGameState('PLAYING');
    setStatusMessage(`EDIFÍCIO NICELAND - FASE ${newStage}!`);
    sound.playLevelComplete();
  }, [initWindows, setFelixPosition]);

  // Felix Action: Hammer current window
  const handleHammer = useCallback(() => {
    if (gameState !== 'PLAYING') return;
    const felix = felixRef.current;
    if (felix.isHammering || felix.isHurt) return;

    felix.isHammering = true;
    felix.hammerTimer = 10;
    sound.playGoldenHammer();

    // Check window at current position
    const currentWindow = windowsRef.current.find(
      (w) => w.col === felix.col && w.row === felix.row
    );

    if (currentWindow && currentWindow.state !== 'FIXED') {
      if (currentWindow.state === 'BROKEN') {
        currentWindow.state = 'CRACKED';
        sound.playGlassBreak();
        setScore((s) => {
          const next = s + 100;
          saveHighScore('detona_ralph', next);
          setHighScore((h) => Math.max(h, next));
          return next;
        });
      } else if (currentWindow.state === 'CRACKED') {
        currentWindow.state = 'FIXED';
        sound.playCoin();
        setScore((s) => {
          const next = s + 200;
          saveHighScore('detona_ralph', next);
          setHighScore((h) => Math.max(h, next));
          return next;
        });
      }

      // Sparkles effect
      for (let i = 0; i < 10; i++) {
        particlesRef.current.push({
          x: currentWindow.x + WINDOW_WIDTH / 2 + (Math.random() - 0.5) * 20,
          y: currentWindow.y + WINDOW_HEIGHT / 2 + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          color: '#facc15',
          alpha: 1,
        });
      }

      // Check if ALL windows are fixed!
      const remaining = windowsRef.current.filter((w) => w.state !== 'FIXED').length;
      if (remaining === 0) {
        // Stage Complete!
        setGameState('STAGE_CLEAR');
        sound.playLevelComplete();
        setStatusMessage('TODAS AS JANELAS CONSERTADAS! VOCÊ VENCEU!');
        ralphRef.current.state = 'MAD';
        ralphRef.current.stateTimer = 9999;
        awardAuraWin('Detona Ralph');
      }
    }
  }, [gameState]);

  // Felix Movement (Jumping between sills)
  const handleMove = useCallback((dir: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN') => {
    if (gameState !== 'PLAYING') return;
    const felix = felixRef.current;
    if (felix.isHurt) return;

    let targetCol = felix.col;
    let targetRow = felix.row;

    if (dir === 'LEFT' && targetCol > 0) {
      targetCol--;
      felix.facing = 'LEFT';
    } else if (dir === 'RIGHT' && targetCol < COLS - 1) {
      targetCol++;
      felix.facing = 'RIGHT';
    } else if (dir === 'UP' && targetRow > 0) {
      targetRow--;
    } else if (dir === 'DOWN' && targetRow < ROWS - 1) {
      targetRow++;
    } else {
      return;
    }

    // Check if target window has closed shutter
    const targetWin = windowsRef.current.find(
      (w) => w.col === targetCol && w.row === targetRow
    );
    if (targetWin?.hasShutter) {
      sound.playCushion();
      return; // Shutter blocks landing!
    }

    sound.playJump();
    felix.isJumping = true;
    felix.jumpTimer = 8;
    setFelixPosition(targetCol, targetRow);

    // Check if stepped on a Pie!
    if (targetWin?.hasPie) {
      targetWin.hasPie = false;
      sound.playPieBonus();
      setInvincibleTime(10); // 10 seconds of golden invulnerability
      setStatusMessage('TORTA COLETADA! SUPER VELOCIDADE E INVULNERABILIDADE!');
      setScore((s) => {
        const next = s + 1000;
        saveHighScore('detona_ralph', next);
        setHighScore((h) => Math.max(h, next));
        return next;
      });
    }
  }, [gameState, setFelixPosition]);

  // Felix hit by brick or pigeon
  const handleFelixHurt = useCallback(() => {
    if (invincibleTime > 0) return; // invulnerable!
    const felix = felixRef.current;
    if (felix.isHurt) return;

    felix.isHurt = true;
    felix.hurtTimer = 45;
    sound.playPunchHeavy();
    screenShakeRef.current = 10;

    setLives((prev) => {
      const nextLives = prev - 1;
      if (nextLives <= 0) {
        sound.playGameOver();
        setGameState('GAMEOVER');
        setStatusMessage('RALPH DETONOU TUDO! FIM DE JOGO!');
        triggerDefeat('Detona Ralph');
      } else {
        setStatusMessage(`CUIDADO! VOCÊ FOI ATINGIDO! VIDAS: ${nextLives}`);
      }
      return nextLives;
    });
  }, [invincibleTime]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'z', 'Z', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === ' ' || e.key === 'z' || e.key === 'Z') {
        handleHammer();
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        handleMove('LEFT');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        handleMove('RIGHT');
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        handleMove('UP');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        handleMove('DOWN');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleHammer, handleMove]);

  // Invincibility countdown
  useEffect(() => {
    if (invincibleTime <= 0) return;
    const interval = setInterval(() => {
      setInvincibleTime((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [invincibleTime]);

  // Main 60 FPS Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      if (gameState === 'PLAYING') {
        updateGame();
      }
      render(ctx);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    const updateGame = () => {
      const now = Date.now();

      // Screen shake decay
      if (screenShakeRef.current > 0) {
        screenShakeRef.current = Math.max(0, screenShakeRef.current - 1);
      }

      // 1. Update Felix position interpolation
      const felix = felixRef.current;
      felix.x += (felix.targetX - felix.x) * 0.35;
      felix.y += (felix.targetY - felix.y) * 0.35;

      if (felix.hammerTimer > 0) felix.hammerTimer--;
      if (felix.hammerTimer <= 0) felix.isHammering = false;

      if (felix.jumpTimer > 0) felix.jumpTimer--;
      if (felix.jumpTimer <= 0) felix.isJumping = false;

      if (felix.hurtTimer > 0) felix.hurtTimer--;
      if (felix.hurtTimer <= 0) felix.isHurt = false;

      // 2. Update Ralph AI
      const ralph = ralphRef.current;
      ralph.x += (ralph.targetX - ralph.x) * 0.08;

      if (ralph.stateTimer > 0) {
        ralph.stateTimer--;
        if (ralph.stateTimer <= 0) {
          ralph.state = 'IDLE';
        }
      }

      if (ralph.state === 'IDLE' && now > nextRalphAttackRef.current) {
        // Choose random column to throw brick or stomp
        const targetCol = Math.floor(Math.random() * COLS);
        const colX = START_X + targetCol * (WINDOW_WIDTH + GAP_X) + WINDOW_WIDTH / 2;
        ralph.targetX = colX;
        ralph.facing = colX > ralph.x ? 'RIGHT' : 'LEFT';

        if (Math.random() < 0.6) {
          // Throw Brick!
          ralph.state = 'THROWING';
          ralph.stateTimer = 25;
          sound.playClick();

          // Spawn Brick
          bricksRef.current.push({
            id: Math.random(),
            x: colX,
            y: ralph.y + 40,
            vy: 2.8 + stage * 0.45,
            vx: (Math.random() - 0.5) * 0.8,
            rotation: 0,
            vRot: (Math.random() - 0.5) * 0.2,
          });
        } else {
          // Stomp and smash window!
          ralph.state = 'STOMPING';
          ralph.stateTimer = 35;
          sound.playRalphStomp();
          screenShakeRef.current = 6;

          // Occasionally crack a top-floor window
          const topWin = windowsRef.current.find((w) => w.col === targetCol && w.row === 0);
          if (topWin && topWin.state === 'FIXED') {
            topWin.state = 'CRACKED';
            sound.playGlassBreak();
          }
        }

        const attackDelay = Math.max(1200, 2600 - stage * 300);
        nextRalphAttackRef.current = now + attackDelay;
      }

      // 3. Update Falling Bricks
      bricksRef.current.forEach((b) => {
        b.y += b.vy;
        b.x += b.vx;
        b.rotation += b.vRot;

        // Collision with Felix
        const dist = Math.hypot(b.x - felix.x, b.y - (felix.y - 18));
        if (dist < 20) {
          handleFelixHurt();
          b.y = CANVAS_HEIGHT + 100; // remove brick
        }
      });
      // Remove offscreen bricks
      bricksRef.current = bricksRef.current.filter((b) => b.y < CANVAS_HEIGHT + 20);

      // 4. Update Flying Pigeons (stage >= 2)
      if (stage >= 2 && now > nextPigeonTimeRef.current) {
        const fromLeft = Math.random() < 0.5;
        const pigeonRow = Math.floor(Math.random() * (ROWS - 1)) + 1; // row 1, 2, or 3
        const pigeonY = START_Y + pigeonRow * (WINDOW_HEIGHT + GAP_Y) + WINDOW_HEIGHT / 2;

        pigeonsRef.current.push({
          id: Math.random(),
          x: fromLeft ? -20 : CANVAS_WIDTH + 20,
          y: pigeonY,
          vx: (fromLeft ? 1 : -1) * (2.2 + stage * 0.3),
          wingTimer: 0,
        });

        nextPigeonTimeRef.current = now + 4000 + Math.random() * 5000;
      }

      pigeonsRef.current.forEach((p) => {
        p.x += p.vx;
        p.wingTimer += 0.2;

        // Collision with Felix
        const dist = Math.hypot(p.x - felix.x, p.y - (felix.y - 18));
        if (dist < 22) {
          handleFelixHurt();
        }
      });
      pigeonsRef.current = pigeonsRef.current.filter((p) => p.x > -50 && p.x < CANVAS_WIDTH + 50);

      // 5. Spawn Pie on a fixed window occasionally
      if (now > nextPieTimeRef.current) {
        const fixedWindows = windowsRef.current.filter((w) => w.state === 'FIXED' && !w.hasPie);
        if (fixedWindows.length > 0) {
          const randWin = fixedWindows[Math.floor(Math.random() * fixedWindows.length)];
          randWin.hasPie = true;
          sound.playCoin();
        }
        nextPieTimeRef.current = now + 12000 + Math.random() * 10000;
      }

      // 6. Update Sparkle Particles
      particlesRef.current = particlesRef.current
        .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, alpha: p.alpha - 0.05 }))
        .filter((p) => p.alpha > 0);
    };

    // Render Canvas
    const render = (c: CanvasRenderingContext2D) => {
      c.save();

      // Screen shake
      if (screenShakeRef.current > 0) {
        c.translate(
          (Math.random() - 0.5) * screenShakeRef.current * 1.5,
          (Math.random() - 0.5) * screenShakeRef.current * 1.5
        );
      }

      // Sky Background
      c.fillStyle = '#0f172a';
      c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Distant 8-bit City Skyline
      c.fillStyle = '#1e293b';
      c.fillRect(20, 100, 60, 420);
      c.fillRect(100, 80, 50, 440);
      c.fillRect(340, 110, 70, 410);
      c.fillRect(420, 90, 50, 430);

      // NICELAND APARTMENTS BUILDING
      renderBuilding(c);

      // Windows
      windowsRef.current.forEach((w) => renderWindow(c, w));

      // Ralph
      renderRalph(c);

      // Felix Jr.
      renderFelix(c);

      // Falling Bricks
      bricksRef.current.forEach((b) => renderBrick(c, b));

      // Flying Pigeons
      pigeonsRef.current.forEach((p) => renderPigeon(c, p));

      // Sparkles
      particlesRef.current.forEach((p) => {
        c.save();
        c.globalAlpha = p.alpha;
        c.fillStyle = p.color;
        c.shadowColor = p.color;
        c.shadowBlur = 8;
        c.fillRect(p.x, p.y, 4, 4);
        c.restore();
      });

      c.restore();
    };

    // Render Niceland Building facade
    const renderBuilding = (c: CanvasRenderingContext2D) => {
      // Main Brick Tower
      const bX = START_X - 22;
      const bY = 70;
      const bW = COLS * (WINDOW_WIDTH + GAP_X) + 16;
      const bH = CANVAS_HEIGHT - 70;

      // Dark red brick color
      c.fillStyle = '#991b1b';
      c.fillRect(bX, bY, bW, bH);

      // Concrete roof ledge & Niceland Sign
      c.fillStyle = '#cbd5e1';
      c.fillRect(bX - 10, bY - 14, bW + 20, 16);

      // Art-deco gold marquee sign
      c.fillStyle = '#f59e0b';
      c.fillRect(bX + bW / 2 - 90, bY - 32, 180, 18);
      c.fillStyle = '#0f172a';
      c.font = 'bold 11px monospace';
      c.textAlign = 'center';
      c.fillText('★ EDIFÍCIO NICELAND ★', bX + bW / 2, bY - 20);

      // Subtle Mortar brick lines
      c.strokeStyle = '#7f1d1d';
      c.lineWidth = 1;
      for (let y = bY + 10; y < CANVAS_HEIGHT; y += 14) {
        c.beginPath();
        c.moveTo(bX, y);
        c.lineTo(bX + bW, y);
        c.stroke();
      }

      // Stone window ledges
      windowsRef.current.forEach((w) => {
        c.fillStyle = '#64748b';
        c.fillRect(w.x - 6, w.y + WINDOW_HEIGHT - 4, WINDOW_WIDTH + 12, 8);
      });
    };

    // Render individual window
    const renderWindow = (c: CanvasRenderingContext2D, w: BuildingWindow) => {
      c.save();

      // Window Frame (White stone arch)
      c.fillStyle = '#f8fafc';
      c.fillRect(w.x, w.y, WINDOW_WIDTH, WINDOW_HEIGHT);

      // Inner Pane Area
      const innerX = w.x + 4;
      const innerY = w.y + 4;
      const innerW = WINDOW_WIDTH - 8;
      const innerH = WINDOW_HEIGHT - 12;

      if (w.hasShutter) {
        // Closed wooden shutters (Obstacle)
        c.fillStyle = '#78350f';
        c.fillRect(innerX, innerY, innerW, innerH);
        c.strokeStyle = '#451a03';
        c.lineWidth = 2;
        c.strokeRect(innerX, innerY, innerW, innerH);
        for (let sy = innerY + 6; sy < innerY + innerH; sy += 8) {
          c.beginPath();
          c.moveTo(innerX, sy);
          c.lineTo(innerX + innerW, sy);
          c.stroke();
        }
        c.restore();
        return;
      }

      if (w.state === 'FIXED') {
        // Sparkling clean blue glass
        const glassGrad = c.createLinearGradient(innerX, innerY, innerX + innerW, innerY + innerH);
        glassGrad.addColorStop(0, '#38bdf8');
        glassGrad.addColorStop(1, '#0284c7');
        c.fillStyle = glassGrad;
        c.fillRect(innerX, innerY, innerW, innerH);

        // Window grid dividers
        c.fillStyle = '#f8fafc';
        c.fillRect(innerX + innerW / 2 - 1.5, innerY, 3, innerH);
        c.fillRect(innerX, innerY + innerH / 2 - 1.5, innerW, 3);

        // Glass reflection sheen
        c.fillStyle = 'rgba(255, 255, 255, 0.35)';
        c.beginPath();
        c.moveTo(innerX, innerY);
        c.lineTo(innerX + 16, innerY);
        c.lineTo(innerX, innerY + 16);
        c.fill();
      } else if (w.state === 'CRACKED') {
        // Cracked glass
        c.fillStyle = '#1e293b';
        c.fillRect(innerX, innerY, innerW, innerH);
        c.strokeStyle = '#94a3b8';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(innerX + 8, innerY + 8);
        c.lineTo(innerX + innerW / 2, innerY + innerH / 2);
        c.lineTo(innerX + innerW - 10, innerY + 12);
        c.stroke();
      } else {
        // Fully Broken window (Black hole into apartment room)
        c.fillStyle = '#020617';
        c.fillRect(innerX, innerY, innerW, innerH);
        // Jagged glass shards at the edges
        c.fillStyle = '#64748b';
        c.beginPath();
        c.moveTo(innerX, innerY);
        c.lineTo(innerX + 12, innerY + 15);
        c.lineTo(innerX + 24, innerY);
        c.lineTo(innerX + innerW, innerY + 18);
        c.lineTo(innerX + innerW, innerY);
        c.fill();
      }

      // Delicious Niceland Pie on the ledge!
      if (w.hasPie) {
        c.fillStyle = '#f59e0b'; // golden crust
        c.beginPath();
        c.arc(w.x + WINDOW_WIDTH / 2, w.y + WINDOW_HEIGHT - 6, 8, Math.PI, 0);
        c.fill();
        c.fillStyle = '#dc2626'; // cherry top
        c.fillRect(w.x + WINDOW_WIDTH / 2 - 2, w.y + WINDOW_HEIGHT - 9, 4, 3);

        // Steam particle
        c.fillStyle = 'rgba(255, 255, 255, 0.6)';
        c.fillRect(w.x + WINDOW_WIDTH / 2 - 1, w.y + WINDOW_HEIGHT - 14, 2, 3);
      }

      c.restore();
    };

    // Render Ralph (Detona Ralph)
    const renderRalph = (c: CanvasRenderingContext2D) => {
      const r = ralphRef.current;
      c.save();
      c.translate(r.x, r.y);

      // Ralph's giant body
      // Brown spiky hair & head
      c.fillStyle = '#78350f';
      c.beginPath();
      c.arc(0, -32, 16, 0, Math.PI * 2);
      c.fill();
      // Wild hair spikes
      c.fillRect(-18, -46, 36, 12);

      // Face
      c.fillStyle = '#fcd34d';
      c.fillRect(-11, -34, 22, 14);
      c.fillStyle = '#0f172a'; // fierce eyes
      c.fillRect(-8, -30, 4, 4);
      c.fillRect(4, -30, 4, 4);
      // Nose
      c.fillStyle = '#ea580c';
      c.fillRect(-3, -25, 6, 5);

      // Orange/Red Plaid Overalls
      c.fillStyle = '#c2410c';
      c.fillRect(-22, -18, 44, 32);
      // Overalls green undershirt
      c.fillStyle = '#15803d';
      c.fillRect(-14, -18, 28, 12);

      // Giant Fists
      c.fillStyle = '#fcd34d';
      if (r.state === 'STOMPING' || r.state === 'THROWING') {
        // Raised fists in the air ready to smash!
        c.fillRect(-32, -45, 14, 18);
        c.fillRect(18, -45, 14, 18);
      } else {
        // Resting heavy fists
        c.fillRect(-30, -12, 14, 16);
        c.fillRect(16, -12, 14, 16);
      }

      // Legs / Feet
      c.fillStyle = '#78350f';
      c.fillRect(-18, 14, 12, 14);
      c.fillRect(6, 14, 12, 14);

      // "EU VOU DETONAR!" speech bubble when stomping
      if (r.state === 'STOMPING') {
        c.fillStyle = '#fef08a';
        c.fillRect(-45, -65, 90, 16);
        c.fillStyle = '#0f172a';
        c.font = 'black 9px monospace';
        c.textAlign = 'center';
        c.fillText('EU VOU DETONAR!', 0, -54);
      }

      c.restore();
    };

    // Render Felix Jr.
    const renderFelix = (c: CanvasRenderingContext2D) => {
      const f = felixRef.current;
      c.save();
      c.translate(f.x, f.y);

      // Invulnerable Golden Glow
      if (invincibleTime > 0) {
        c.shadowColor = '#facc15';
        c.shadowBlur = 14;
      }

      // Hurt flashing
      if (f.isHurt && Math.floor(Date.now() / 80) % 2 === 0) {
        c.restore();
        return;
      }

      // Blue cap with "FF"
      c.fillStyle = '#2563eb';
      c.fillRect(-10, -32, 20, 8);
      c.fillRect(f.facing === 'RIGHT' ? -4 : -14, -28, 18, 4); // cap visor

      // Face
      c.fillStyle = '#fed7aa';
      c.fillRect(-8, -24, 16, 12);
      c.fillStyle = '#0f172a'; // cheerful eyes
      c.fillRect(f.facing === 'RIGHT' ? 1 : -5, -21, 3, 3);
      // Big smile
      c.fillStyle = '#ef4444';
      c.fillRect(f.facing === 'RIGHT' ? 0 : -4, -15, 6, 2);

      // Blue shirt & Brown tool belt
      c.fillStyle = '#3b82f6';
      c.fillRect(-9, -12, 18, 14);
      c.fillStyle = '#78350f'; // belt
      c.fillRect(-10, 0, 20, 4);
      c.fillStyle = '#facc15'; // golden buckle
      c.fillRect(-3, 0, 6, 4);

      // Jeans & Work Boots
      c.fillStyle = '#1d4ed8';
      c.fillRect(-8, 4, 6, 8);
      c.fillRect(2, 4, 6, 8);
      c.fillStyle = '#78350f'; // boots
      c.fillRect(-9, 10, 8, 4);
      c.fillRect(1, 10, 8, 4);

      // MAGICAL GOLDEN HAMMER
      c.save();
      c.fillStyle = '#f59e0b';
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1;

      if (f.isHammering) {
        // Swinging forward with arc!
        const hX = f.facing === 'RIGHT' ? 8 : -14;
        c.fillRect(hX, -28, 8, 14);
        c.fillStyle = '#facc15';
        c.fillRect(hX - 2, -32, 12, 6); // hammer head
      } else {
        // In hand
        const hX = f.facing === 'RIGHT' ? 8 : -14;
        c.fillRect(hX, -16, 5, 12);
        c.fillStyle = '#facc15';
        c.fillRect(hX - 2, -20, 9, 5);
      }
      c.restore();

      c.restore();
    };

    // Render Falling Brick
    const renderBrick = (c: CanvasRenderingContext2D, b: FallingBrick) => {
      c.save();
      c.translate(b.x, b.y);
      c.rotate(b.rotation);

      c.fillStyle = '#dc2626';
      c.fillRect(-9, -5, 18, 10);
      c.strokeStyle = '#7f1d1d';
      c.lineWidth = 1.5;
      c.strokeRect(-9, -5, 18, 10);

      // Mortar holes in brick
      c.fillStyle = '#7f1d1d';
      c.fillRect(-5, -2, 3, 4);
      c.fillRect(2, -2, 3, 4);

      c.restore();
    };

    // Render Flying Pigeon
    const renderPigeon = (c: CanvasRenderingContext2D, p: FlyingPigeon) => {
      c.save();
      c.translate(p.x, p.y);
      if (p.vx < 0) c.scale(-1, 1);

      // Grey body
      c.fillStyle = '#94a3b8';
      c.beginPath();
      c.arc(0, 0, 7, 0, Math.PI * 2);
      c.fill();

      // Beak
      c.fillStyle = '#f59e0b';
      c.fillRect(6, -2, 4, 3);

      // Flapping Wing
      const wingY = Math.sin(p.wingTimer * 10) * 6;
      c.fillStyle = '#64748b';
      c.beginPath();
      c.moveTo(-2, 0);
      c.lineTo(-8, wingY);
      c.lineTo(2, 0);
      c.fill();

      c.restore();
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState, stage, invincibleTime, handleFelixHurt]);

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto font-sans select-none">
      {/* RETRO ARCADE HUD */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-t-2xl p-3 flex flex-col gap-2 shadow-xl">
        <div className="flex items-center justify-between">
          {/* Stage & Title */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏢</span>
            <div>
              <div className="font-black text-white text-xs sm:text-sm tracking-wide flex items-center gap-1.5">
                <span>CONSERTA FELIX JR.</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-[10px]">
                  FASE {stage}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {statusMessage}
              </div>
            </div>
          </div>

          {/* Lives (Felix Hats) & High Score */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[10px] font-mono text-slate-400">VIDAS:</span>
              {Array.from({ length: 3 }).map((_, i) => (
                <span
                  key={i}
                  className={`text-sm transition-opacity ${
                    i < lives ? 'opacity-100' : 'opacity-20'
                  }`}
                  title="Vida"
                >
                  🧢
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 font-mono">
              <span className="text-[10px] text-slate-400">PONTOS:</span>
              <span className="text-xs sm:text-sm font-black text-amber-400">
                {score.toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        </div>

        {/* Invulnerability Bar (Pie Power) */}
        {invincibleTime > 0 && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1 text-xs font-mono text-amber-300 animate-pulse">
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span className="text-[10px] font-bold">SUPER TORTA ATIVA: {invincibleTime}s</span>
            <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-200"
                style={{ width: `${(invincibleTime / 10) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Arcade Building Canvas */}
      <div className="relative w-full aspect-[480/520] max-h-[520px] bg-slate-950 border-x border-slate-800 overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full block"
        />

        {/* Start Game Modal */}
        {gameState === 'IDLE' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3 shadow-lg shadow-amber-500/20 text-3xl">
              🔨
            </div>
            <h3 className="text-2xl font-black text-white mb-1">Detona Ralph (Fix-It Felix Jr.)</h3>
            <p className="text-xs text-amber-400 font-mono mb-4 uppercase tracking-widest">
              Arcade Oficial Niceland 1982
            </p>
            <p className="text-xs text-slate-300 max-w-sm mb-6 leading-relaxed">
              Ralph está furioso destruindo todas as vidraças do Edifício Niceland! Pule de janela em janela com Felix, use seu Martelo Mágico dourado para consertar os vidros, desvie dos tijolos e saboreie as tortas dos moradores!
            </p>
            <button
              onClick={() => startGame(1, true)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 active:scale-95 transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Eu Posso Consertar! (Jogar)
            </button>
          </div>
        )}

        {/* Stage Clear Modal */}
        {gameState === 'STAGE_CLEAR' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="text-4xl mb-2 animate-bounce">🏆 🥧 🏅</div>
            <div className="text-amber-400 font-mono text-xs tracking-widest font-bold mb-1">
              EDIFÍCIO SALVO!
            </div>
            <h3 className="text-2xl font-black text-white mb-2">Fase {stage} Concluída!</h3>
            <p className="text-xs text-slate-300 mb-6 font-mono">
              Pontuação: <span className="text-amber-400 font-bold">{score.toLocaleString('pt-BR')}</span>
            </p>
            <button
              onClick={() => startGame(stage + 1, false)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Award className="w-4 h-4" />
              Avançar para Fase {stage + 1}!
            </button>
          </div>
        )}

        {/* Game Over Modal */}
        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="text-red-500 font-mono text-xs tracking-widest font-bold mb-1">
              FIM DE JOGO
            </div>
            <h3 className="text-2xl font-black text-white mb-2">Ralph Detonou Tudo!</h3>
            <p className="text-xs text-slate-400 mb-6 font-mono">
              Pontuação Final: <span className="text-amber-400 font-bold">{score.toLocaleString('pt-BR')}</span>
            </p>
            <button
              onClick={() => startGame(1, true)}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Tentar Novamente
            </button>
          </div>
        )}
      </div>

      {/* Modern Arcade Mobile / Action Pad */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-b-2xl p-3 flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-3 items-center">
          {/* Virtual D-Pad for jumping between window ledges */}
          <div className="flex flex-col items-center justify-center bg-slate-950/60 p-2 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 mb-1">PULAR ENTRE JANELAS</span>
            <div className="grid grid-cols-3 gap-1">
              <div />
              <button
                type="button"
                onClick={() => handleMove('UP')}
                className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold flex items-center justify-center"
                title="Pular para o andar superior (W / Seta Cima)"
              >
                <ArrowUp className="w-5 h-5 text-amber-400" />
              </button>
              <div />

              <button
                type="button"
                onClick={() => handleMove('LEFT')}
                className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold flex items-center justify-center"
                title="Pular para esquerda (A / Seta Esquerda)"
              >
                <ArrowLeft className="w-5 h-5 text-cyan-400" />
              </button>

              <button
                type="button"
                onClick={() => handleMove('DOWN')}
                className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold flex items-center justify-center"
                title="Descer para andar inferior (S / Seta Baixo)"
              >
                <ArrowDown className="w-5 h-5 text-amber-400" />
              </button>

              <button
                type="button"
                onClick={() => handleMove('RIGHT')}
                className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold flex items-center justify-center"
                title="Pular para direita (D / Seta Direita)"
              >
                <ArrowRight className="w-5 h-5 text-cyan-400" />
              </button>
            </div>
          </div>

          {/* Action Hammer Button */}
          <div className="flex flex-col gap-2 h-full justify-center">
            <button
              type="button"
              onClick={handleHammer}
              className="w-full py-5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm flex flex-col items-center justify-center gap-1 shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
            >
              <span className="text-xl">🔨</span>
              <span>CONSERTAR!</span>
              <span className="text-[9px] font-mono opacity-80">(Espaço ou Z)</span>
            </button>
          </div>
        </div>

        {/* Footer Record & Info */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800 font-mono">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Recorde: {highScore.toLocaleString('pt-BR')}</span>
          </div>

          <div className="text-[10px] text-slate-500">
            Fix-It Felix Jr. © 1982 / 2012
          </div>
        </div>
      </div>
    </div>
  );
}
