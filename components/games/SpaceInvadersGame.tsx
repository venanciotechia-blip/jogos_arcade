'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Trophy, Heart, Crosshair } from 'lucide-react';
import { sound } from '@/lib/sound';
import { getHighScore, saveHighScore } from '@/lib/gameStore';
import { VirtualController } from '../VirtualController';

interface Invader {
  x: number;
  y: number;
  type: 0 | 1 | 2; // 0: squid (30pts), 1: crab (20pts), 2: octopus (10pts)
  alive: boolean;
}

interface Bullet {
  x: number;
  y: number;
  speed: number;
  isPlayer: boolean;
}

interface Bunker {
  x: number;
  y: number;
  w: number;
  h: number;
  grid: number[][]; // 8x6 blocks that chip away
}

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 520;
const ROWS = 5;
const COLS = 10;

export function SpaceInvadersGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'VICTORY'>('IDLE');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => getHighScore('invaders'));
  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);

  // Game internal mutable state
  const playerXRef = useRef(CANVAS_WIDTH / 2 - 16);
  const invadersRef = useRef<Invader[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const bunkersRef = useRef<Bunker[]>([]);
  const invaderDirRef = useRef<number>(1); // 1 = right, -1 = left
  const invaderStepDownRef = useRef<boolean>(false);
  const animFrameStepRef = useRef<number>(0);
  const lastInvaderMoveTimeRef = useRef<number>(0);
  const ufoRef = useRef<{ x: number; y: number; active: boolean; dir: number } | null>(null);
  const keysPressedRef = useRef<Record<string, boolean>>({});
  const lastShotTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  const initBunkers = (): Bunker[] => {
    const bunkers: Bunker[] = [];
    const count = 4;
    const bunkerW = 54;
    const bunkerH = 36;
    const gap = (CANVAS_WIDTH - count * bunkerW) / (count + 1);

    for (let i = 0; i < count; i++) {
      const bx = gap + i * (bunkerW + gap);
      const by = CANVAS_HEIGHT - 110;
      // 6 rows x 9 columns
      const grid = Array.from({ length: 6 }, () => Array(9).fill(1));
      // carve out arch at bottom center
      grid[4][3] = 0; grid[4][4] = 0; grid[4][5] = 0;
      grid[5][2] = 0; grid[5][3] = 0; grid[5][4] = 0; grid[5][5] = 0; grid[5][6] = 0;
      // notch top corners
      grid[0][0] = 0; grid[0][8] = 0;

      bunkers.push({ x: bx, y: by, w: bunkerW, h: bunkerH, grid });
    }
    return bunkers;
  };

  const initWave = useCallback((waveNumber: number) => {
    const list: Invader[] = [];
    const startX = 40;
    const startY = 65 + (waveNumber - 1) * 10;
    const invaderSpacingX = 38;
    const invaderSpacingY = 28;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let type: 0 | 1 | 2 = 2; // Octopus
        if (r === 0) type = 0; // Squid
        else if (r === 1 || r === 2) type = 1; // Crab

        list.push({
          x: startX + c * invaderSpacingX,
          y: startY + r * invaderSpacingY,
          type,
          alive: true,
        });
      }
    }

    invadersRef.current = list;
    invaderDirRef.current = 1;
    bulletsRef.current = [];
    ufoRef.current = null;
  }, []);

  const resetGame = useCallback(() => {
    playerXRef.current = CANVAS_WIDTH / 2 - 16;
    bunkersRef.current = initBunkers();
    setLives(3);
    setScore(0);
    setWave(1);
    initWave(1);
    setGameState('PLAYING');
    sound.playClick();
  }, [initWave]);

  const shootPlayerBullet = useCallback(() => {
    if (gameState !== 'PLAYING') return;
    const now = Date.now();
    if (now - lastShotTimeRef.current < 260) return; // rate limit

    // Max 2 player bullets active on screen
    const activePlayerBullets = bulletsRef.current.filter((b) => b.isPlayer);
    if (activePlayerBullets.length >= 2) return;

    lastShotTimeRef.current = now;
    bulletsRef.current.push({
      x: playerXRef.current + 15,
      y: CANVAS_HEIGHT - 48,
      speed: -8,
      isPlayer: true,
    });
    sound.playLaser();
  }, [gameState]);

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      keysPressedRef.current[e.key] = true;

      if (e.key === 'p' || e.key === 'P') {
        setGameState((s) => (s === 'PLAYING' ? 'PAUSED' : s === 'PAUSED' ? 'PLAYING' : s));
        return;
      }

      if (e.key === ' ' && gameState === 'PLAYING') {
        shootPlayerBullet();
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
  }, [gameState, shootPlayerBullet]);

  // Main game tick & render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = (timestamp: number) => {
      if (gameState === 'PLAYING') {
        // Player movement
        const keys = keysPressedRef.current;
        const speed = 4.5;
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
          playerXRef.current = Math.max(12, playerXRef.current - speed);
        }
        if (keys['ArrowRight'] || keys['d'] || keys['D']) {
          playerXRef.current = Math.min(CANVAS_WIDTH - 42, playerXRef.current + speed);
        }

        // Alien fleet pacing (speeds up as aliens decrease)
        const aliveInvaders = invadersRef.current.filter((i) => i.alive);
        const invaderMoveInterval = Math.max(80, (aliveInvaders.length / (ROWS * COLS)) * 750);

        if (timestamp - lastInvaderMoveTimeRef.current >= invaderMoveInterval) {
          lastInvaderMoveTimeRef.current = timestamp;
          animFrameStepRef.current = animFrameStepRef.current === 0 ? 1 : 0;
          sound.playMove();

          let changeDir = false;
          const dir = invaderDirRef.current;

          for (const inv of aliveInvaders) {
            if ((dir === 1 && inv.x >= CANVAS_WIDTH - 46) || (dir === -1 && inv.x <= 16)) {
              changeDir = true;
              break;
            }
          }

          if (changeDir) {
            invaderDirRef.current = -dir;
            for (const inv of aliveInvaders) {
              inv.y += 14;
              // Check invasion reaches player ground
              if (inv.y >= CANVAS_HEIGHT - 80) {
                sound.playGameOver();
                setGameState('GAMEOVER');
                setScore((s) => {
                  saveHighScore('invaders', s);
                  return s;
                });
                return;
              }
            }
          } else {
            for (const inv of aliveInvaders) {
              inv.x += dir * 8;
            }
          }

          // Random alien shoots back
          if (aliveInvaders.length > 0 && Math.random() < 0.45) {
            const randomShooter = aliveInvaders[Math.floor(Math.random() * aliveInvaders.length)];
            bulletsRef.current.push({
              x: randomShooter.x + 12,
              y: randomShooter.y + 18,
              speed: 4.2 + wave * 0.4,
              isPlayer: false,
            });
          }

          // UFO Saucer Spawning
          if (!ufoRef.current && Math.random() < 0.05) {
            const fromLeft = Math.random() > 0.5;
            ufoRef.current = {
              x: fromLeft ? -40 : CANVAS_WIDTH + 10,
              y: 35,
              active: true,
              dir: fromLeft ? 2.5 : -2.5,
            };
          }
        }

        // Move UFO
        if (ufoRef.current && ufoRef.current.active) {
          ufoRef.current.x += ufoRef.current.dir;
          if (ufoRef.current.x < -60 || ufoRef.current.x > CANVAS_WIDTH + 60) {
            ufoRef.current = null;
          }
        }

        // Move Bullets & Check Collisions
        const nextBullets: Bullet[] = [];
        for (const b of bulletsRef.current) {
          b.y += b.speed;

          // Out of screen
          if (b.y < 0 || b.y > CANVAS_HEIGHT) continue;

          let bulletConsumed = false;

          // Bunker collision
          for (const bunker of bunkersRef.current) {
            if (
              b.x >= bunker.x &&
              b.x <= bunker.x + bunker.w &&
              b.y >= bunker.y &&
              b.y <= bunker.y + bunker.h
            ) {
              const col = Math.floor(((b.x - bunker.x) / bunker.w) * 9);
              const row = Math.floor(((b.y - bunker.y) / bunker.h) * 6);
              if (row >= 0 && row < 6 && col >= 0 && col < 9 && bunker.grid[row][col] === 1) {
                bunker.grid[row][col] = 0; // chip away
                // chip neighbor
                if (col > 0) bunker.grid[row][col - 1] = 0;
                if (col < 8) bunker.grid[row][col + 1] = 0;
                bulletConsumed = true;
                break;
              }
            }
          }
          if (bulletConsumed) continue;

          if (b.isPlayer) {
            // Player bullet hits UFO
            if (ufoRef.current && ufoRef.current.active) {
              const u = ufoRef.current;
              if (b.x >= u.x && b.x <= u.x + 36 && b.y >= u.y && b.y <= u.y + 16) {
                ufoRef.current = null;
                sound.playClear();
                const ufoBonus = 150;
                setScore((s) => {
                  const updated = s + ufoBonus;
                  saveHighScore('invaders', updated);
                  return updated;
                });
                bulletConsumed = true;
              }
            }
            if (bulletConsumed) continue;

            // Player bullet hits Invaders
            for (const inv of invadersRef.current) {
              if (inv.alive && b.x >= inv.x && b.x <= inv.x + 24 && b.y >= inv.y && b.y <= inv.y + 20) {
                inv.alive = false;
                bulletConsumed = true;
                sound.playExplosion();

                const points = inv.type === 0 ? 30 : inv.type === 1 ? 20 : 10;
                setScore((s) => {
                  const updated = s + points;
                  saveHighScore('invaders', updated);
                  return updated;
                });
                break;
              }
            }
            if (bulletConsumed) continue;
          } else {
            // Alien bullet hits Player
            const px = playerXRef.current;
            const py = CANVAS_HEIGHT - 44;
            if (b.x >= px && b.x <= px + 30 && b.y >= py && b.y <= py + 18) {
              sound.playExplosion();
              bulletConsumed = true;
              setLives((l) => {
                const nextLives = l - 1;
                if (nextLives <= 0) {
                  sound.playGameOver();
                  setGameState('GAMEOVER');
                  setScore((s) => {
                    saveHighScore('invaders', s);
                    return s;
                  });
                } else {
                  playerXRef.current = CANVAS_WIDTH / 2 - 16;
                }
                return nextLives;
              });
            }
            if (bulletConsumed) continue;
          }

          nextBullets.push(b);
        }
        bulletsRef.current = nextBullets;

        // Check if wave is cleared
        if (aliveInvaders.length === 0) {
          sound.playClear();
          setWave((w) => {
            const nextW = w + 1;
            initWave(nextW);
            return nextW;
          });
        }
      }

      // Render
      renderCanvas(ctx);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    const renderCanvas = (c: CanvasRenderingContext2D) => {
      c.fillStyle = '#050811';
      c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Distant stars background
      c.fillStyle = '#ffffff';
      c.fillRect(30, 20, 1.5, 1.5);
      c.fillRect(150, 45, 1, 1);
      c.fillRect(320, 30, 1.5, 1.5);
      c.fillRect(410, 80, 1, 1);
      c.fillRect(90, 140, 1, 1);
      c.fillRect(250, 180, 1.5, 1.5);

      // UFO Saucer
      if (ufoRef.current && ufoRef.current.active) {
        const u = ufoRef.current;
        c.fillStyle = '#ef4444';
        c.fillRect(u.x + 8, u.y, 20, 4);
        c.fillRect(u.x + 4, u.y + 4, 28, 6);
        c.fillRect(u.x, u.y + 10, 36, 4);
        c.fillStyle = '#fef08a';
        c.fillRect(u.x + 8, u.y + 8, 4, 3);
        c.fillRect(u.x + 16, u.y + 8, 4, 3);
        c.fillRect(u.x + 24, u.y + 8, 4, 3);
      }

      // Invaders
      const step = animFrameStepRef.current;
      invadersRef.current.forEach((inv) => {
        if (!inv.alive) return;
        c.save();
        if (inv.type === 0) {
          // Squid (Cyan)
          c.fillStyle = '#22d3ee';
          drawSquid(c, inv.x, inv.y, step);
        } else if (inv.type === 1) {
          // Crab (Pink)
          c.fillStyle = '#f472b6';
          drawCrab(c, inv.x, inv.y, step);
        } else {
          // Octopus (Green)
          c.fillStyle = '#4ade80';
          drawOctopus(c, inv.x, inv.y, step);
        }
        c.restore();
      });

      // Bunkers
      bunkersRef.current.forEach((bunker) => {
        const cellW = bunker.w / 9;
        const cellH = bunker.h / 6;
        c.fillStyle = '#10b981';

        for (let r = 0; r < 6; r++) {
          for (let col = 0; col < 9; col++) {
            if (bunker.grid[r][col] === 1) {
              c.fillRect(bunker.x + col * cellW, bunker.y + r * cellH, cellW, cellH);
            }
          }
        }
      });

      // Bullets
      bulletsRef.current.forEach((b) => {
        if (b.isPlayer) {
          c.fillStyle = '#38bdf8';
          c.shadowColor = '#38bdf8';
          c.shadowBlur = 6;
          c.fillRect(b.x - 1.5, b.y, 3, 10);
        } else {
          c.fillStyle = '#f87171';
          c.shadowColor = '#f87171';
          c.shadowBlur = 6;
          c.fillRect(b.x - 1, b.y, 2, 8);
        }
      });

      // Player Cannon
      const px = playerXRef.current;
      const py = CANVAS_HEIGHT - 44;
      c.save();
      c.shadowColor = '#10b981';
      c.shadowBlur = 8;
      c.fillStyle = '#10b981';
      c.fillRect(px, py + 8, 30, 8);
      c.fillRect(px + 4, py + 4, 22, 4);
      c.fillRect(px + 13, py, 4, 4);
      c.restore();

      // Green ground defense line
      c.strokeStyle = '#059669';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, CANVAS_HEIGHT - 20);
      c.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 20);
      c.stroke();
    };

    const drawSquid = (c: CanvasRenderingContext2D, x: number, y: number, frame: number) => {
      c.fillRect(x + 8, y, 8, 3);
      c.fillRect(x + 4, y + 3, 16, 3);
      c.fillRect(x + 2, y + 6, 20, 4);
      c.fillRect(x + 6, y + 10, 12, 3);
      if (frame === 0) {
        c.fillRect(x + 4, y + 13, 4, 4);
        c.fillRect(x + 16, y + 13, 4, 4);
      } else {
        c.fillRect(x, y + 13, 4, 4);
        c.fillRect(x + 20, y + 13, 4, 4);
      }
    };

    const drawCrab = (c: CanvasRenderingContext2D, x: number, y: number, frame: number) => {
      c.fillRect(x + 4, y, 4, 3);
      c.fillRect(x + 16, y, 4, 3);
      c.fillRect(x + 2, y + 3, 20, 3);
      c.fillRect(x, y + 6, 24, 4);
      c.fillRect(x + 4, y + 10, 16, 3);
      if (frame === 0) {
        c.fillRect(x, y + 13, 4, 4);
        c.fillRect(x + 20, y + 13, 4, 4);
      } else {
        c.fillRect(x + 6, y + 13, 4, 4);
        c.fillRect(x + 14, y + 13, 4, 4);
      }
    };

    const drawOctopus = (c: CanvasRenderingContext2D, x: number, y: number, frame: number) => {
      c.fillRect(x + 6, y, 12, 3);
      c.fillRect(x + 4, y + 3, 16, 4);
      c.fillRect(x + 2, y + 7, 20, 3);
      c.fillRect(x + 4, y + 10, 16, 3);
      if (frame === 0) {
        c.fillRect(x + 2, y + 13, 4, 3);
        c.fillRect(x + 18, y + 13, 4, 3);
      } else {
        c.fillRect(x + 6, y + 13, 4, 3);
        c.fillRect(x + 14, y + 13, 4, 3);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState, wave, initWave]);

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto">
      {/* Top HUD */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/90 border border-slate-800 rounded-t-xl text-xs font-mono">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-400">PONTOS:</span>{' '}
            <span className="text-lg font-bold text-pink-400 tabular-nums">{score}</span>
          </div>
          <div>
            <span className="text-slate-400">ONDA:</span>{' '}
            <span className="font-bold text-amber-400 tabular-nums">{wave}</span>
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

        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/30 px-2.5 py-1 rounded border border-amber-800/40">
          <Trophy className="w-3.5 h-3.5" />
          <span className="font-bold tabular-nums">{highScore}</span>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative w-full aspect-[480/520] max-h-[500px] bg-slate-950 border-x border-slate-800 overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full block"
        />

        {gameState === 'IDLE' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <h3 className="text-xl font-bold text-white mb-2">Invasores Espaciais</h3>
            <p className="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
              Mova seu canhão para os lados e atire com a barra de espaço. Destrua os aliens e a nave-mãe misteriosa!
            </p>
            <button
              onClick={resetGame}
              className="px-6 py-2.5 rounded-lg bg-pink-500 hover:bg-pink-400 text-slate-950 font-bold text-sm shadow-lg shadow-pink-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Iniciar Defesa
            </button>
          </div>
        )}

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

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="text-red-500 font-mono text-sm tracking-widest font-bold mb-1">INVASÃO COMPLETA</div>
            <h3 className="text-3xl font-black text-white mb-3">A Terra Sucumbiu!</h3>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 w-56 mb-5 text-left text-xs font-mono space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Pontos:</span>
                <span className="text-pink-400 font-bold tabular-nums">{score}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ondas Defendidas:</span>
                <span className="text-slate-200 font-bold tabular-nums">{wave}</span>
              </div>
            </div>

            <button
              onClick={resetGame}
              className="px-6 py-2.5 rounded-lg bg-pink-500 hover:bg-pink-400 text-slate-950 font-bold text-sm shadow-lg shadow-pink-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Jogar Novamente
            </button>
          </div>
        )}
      </div>

      {/* Bottom Bar & Virtual Controller */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-b-xl p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (gameState === 'PLAYING') setGameState('PAUSED');
                else if (gameState === 'PAUSED') setGameState('PLAYING');
              }}
              disabled={gameState === 'IDLE' || gameState === 'GAMEOVER'}
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
            Setas Esquerda/Direita para mover · Espaço para atirar
          </span>
        </div>

        <VirtualController
          onDirection={(dir) => {
            if (dir === 'LEFT') playerXRef.current = Math.max(12, playerXRef.current - 24);
            if (dir === 'RIGHT') playerXRef.current = Math.min(CANVAS_WIDTH - 42, playerXRef.current + 24);
          }}
          onActionA={shootPlayerBullet}
          actionALabel="FOGO"
        />
      </div>
    </div>
  );
}
