'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Trophy, Heart, Sparkles } from 'lucide-react';
import { sound } from '@/lib/sound';
import { getHighScore, saveHighScore } from '@/lib/gameStore';
import { awardAuraWin, triggerDefeat } from '@/lib/auraStore';
import { VirtualController } from '../VirtualController';

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  points: number;
  alive: boolean;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface PowerUp {
  x: number;
  y: number;
  type: 'EXPAND' | 'MULTIBALL' | 'SLOW';
  vy: number;
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
const CANVAS_HEIGHT = 480;

const BRICK_ROWS = 5;
const BRICK_COLS = 8;
const ROW_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4'];
const ROW_POINTS = [50, 40, 30, 20, 10];

export function BreakoutGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'VICTORY'>('IDLE');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => getHighScore('breakout'));
  const [lives, setLives] = useState(3);

  // Mutable refs
  const paddleWidthRef = useRef(75);
  const paddleXRef = useRef(CANVAS_WIDTH / 2 - 37.5);
  const ballsRef = useRef<Ball[]>([]);
  const bricksRef = useRef<Brick[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysPressedRef = useRef<Record<string, boolean>>({});
  const animFrameRef = useRef<number | null>(null);

  const initBricks = (): Brick[] => {
    const bricks: Brick[] = [];
    const brickW = 50;
    const brickH = 16;
    const padding = 6;
    const offsetTop = 50;
    const offsetLeft = (CANVAS_WIDTH - (BRICK_COLS * (brickW + padding) - padding)) / 2;

    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          x: offsetLeft + c * (brickW + padding),
          y: offsetTop + r * (brickH + padding),
          w: brickW,
          h: brickH,
          color: ROW_COLORS[r],
          points: ROW_POINTS[r],
          alive: true,
        });
      }
    }
    return bricks;
  };

  const spawnInitialBall = () => {
    ballsRef.current = [
      {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT - 45,
        vx: (Math.random() > 0.5 ? 1 : -1) * 3.5,
        vy: -4.5,
        radius: 5,
      },
    ];
  };

  const resetGame = useCallback(() => {
    paddleWidthRef.current = 75;
    paddleXRef.current = CANVAS_WIDTH / 2 - 37.5;
    bricksRef.current = initBricks();
    powerUpsRef.current = [];
    particlesRef.current = [];
    spawnInitialBall();
    setLives(3);
    setScore(0);
    setGameState('PLAYING');
    sound.playClick();
  }, []);

  // Keyboard navigation & mouse move
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      keysPressedRef.current[e.key] = true;

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

  // Mouse / Pointer Move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const scaleX = CANVAS_WIDTH / rect.width;
    const targetX = clientX * scaleX - paddleWidthRef.current / 2;
    paddleXRef.current = Math.max(0, Math.min(CANVAS_WIDTH - paddleWidthRef.current, targetX));
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (gameState !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (!canvas || !e.touches[0]) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches[0].clientX - rect.left;
    const scaleX = CANVAS_WIDTH / rect.width;
    const targetX = clientX * scaleX - paddleWidthRef.current / 2;
    paddleXRef.current = Math.max(0, Math.min(CANVAS_WIDTH - paddleWidthRef.current, targetX));
  };

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      if (gameState === 'PLAYING') {
        // Paddle movement with keys
        const keys = keysPressedRef.current;
        const pSpeed = 6;
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
          paddleXRef.current = Math.max(0, paddleXRef.current - pSpeed);
        }
        if (keys['ArrowRight'] || keys['d'] || keys['D']) {
          paddleXRef.current = Math.min(CANVAS_WIDTH - paddleWidthRef.current, paddleXRef.current + pSpeed);
        }

        const paddleX = paddleXRef.current;
        const paddleW = paddleWidthRef.current;
        const paddleY = CANVAS_HEIGHT - 26;
        const paddleH = 10;

        // Update Balls
        const remainingBalls: Ball[] = [];

        for (const ball of ballsRef.current) {
          ball.x += ball.vx;
          ball.y += ball.vy;

          // Wall bounce (Left/Right)
          if (ball.x - ball.radius <= 0) {
            ball.x = ball.radius;
            ball.vx = Math.abs(ball.vx);
            sound.playBounce();
          } else if (ball.x + ball.radius >= CANVAS_WIDTH) {
            ball.x = CANVAS_WIDTH - ball.radius;
            ball.vx = -Math.abs(ball.vx);
            sound.playBounce();
          }

          // Ceiling bounce
          if (ball.y - ball.radius <= 0) {
            ball.y = ball.radius;
            ball.vy = Math.abs(ball.vy);
            sound.playBounce();
          }

          // Paddle bounce
          if (
            ball.y + ball.radius >= paddleY &&
            ball.y - ball.radius <= paddleY + paddleH &&
            ball.x >= paddleX &&
            ball.x <= paddleX + paddleW &&
            ball.vy > 0
          ) {
            // Calculate hit position relative to center of paddle (-1 to 1)
            const hitRatio = (ball.x - (paddleX + paddleW / 2)) / (paddleW / 2);
            const currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            const newSpeed = Math.min(8.5, currentSpeed + 0.1);

            const maxAngle = (Math.PI / 3); // 60 degrees max
            const angle = hitRatio * maxAngle;

            ball.vx = newSpeed * Math.sin(angle);
            ball.vy = -newSpeed * Math.cos(angle);
            ball.y = paddleY - ball.radius;

            sound.playBounce();
          }

          // Brick collision
          for (const brick of bricksRef.current) {
            if (!brick.alive) continue;

            if (
              ball.x + ball.radius >= brick.x &&
              ball.x - ball.radius <= brick.x + brick.w &&
              ball.y + ball.radius >= brick.y &&
              ball.y - ball.radius <= brick.y + brick.h
            ) {
              brick.alive = false;
              sound.playLaser();

              // Spawn particles
              for (let p = 0; p < 8; p++) {
                particlesRef.current.push({
                  x: brick.x + brick.w / 2,
                  y: brick.y + brick.h / 2,
                  vx: (Math.random() - 0.5) * 4,
                  vy: (Math.random() - 0.5) * 4,
                  color: brick.color,
                  alpha: 1,
                });
              }

              // PowerUp drop chance (18%)
              if (Math.random() < 0.18) {
                const types: ('EXPAND' | 'MULTIBALL' | 'SLOW')[] = ['EXPAND', 'MULTIBALL', 'SLOW'];
                const chosen = types[Math.floor(Math.random() * types.length)];
                powerUpsRef.current.push({
                  x: brick.x + brick.w / 2,
                  y: brick.y + brick.h,
                  type: chosen,
                  vy: 2.2,
                });
              }

              // Determine bounce axis
              const overlapLeft = ball.x + ball.radius - brick.x;
              const overlapRight = brick.x + brick.w - (ball.x - ball.radius);
              const overlapTop = ball.y + ball.radius - brick.y;
              const overlapBottom = brick.y + brick.h - (ball.y - ball.radius);
              const minOverlapX = Math.min(overlapLeft, overlapRight);
              const minOverlapY = Math.min(overlapTop, overlapBottom);

              if (minOverlapX < minOverlapY) {
                ball.vx = -ball.vx;
              } else {
                ball.vy = -ball.vy;
              }

              setScore((s) => {
                const nextScore = s + brick.points;
                saveHighScore('breakout', nextScore);
                return nextScore;
              });
              break;
            }
          }

          // Bottom screen loss
          if (ball.y - ball.radius > CANVAS_HEIGHT) {
            // Ball lost
          } else {
            remainingBalls.push(ball);
          }
        }

        ballsRef.current = remainingBalls;

        // If no balls remaining
        if (remainingBalls.length === 0) {
          sound.playExplosion();
          setLives((l) => {
            const nextL = l - 1;
            if (nextL <= 0) {
              sound.playGameOver();
              setGameState('GAMEOVER');
              triggerDefeat('Quebra-Blocos');
            } else {
              spawnInitialBall();
            }
            return nextL;
          });
        }

        // Update Powerups
        const nextPowerUps: PowerUp[] = [];
        for (const pu of powerUpsRef.current) {
          pu.y += pu.vy;

          // Catch powerup
          if (
            pu.y >= paddleY &&
            pu.y <= paddleY + paddleH &&
            pu.x >= paddleX &&
            pu.x <= paddleX + paddleW
          ) {
            sound.playEat();
            if (pu.type === 'EXPAND') {
              paddleWidthRef.current = Math.min(130, paddleWidthRef.current + 25);
            } else if (pu.type === 'MULTIBALL') {
              if (ballsRef.current.length > 0) {
                const b = ballsRef.current[0];
                ballsRef.current.push(
                  { x: b.x, y: b.y, vx: -b.vx, vy: b.vy, radius: 5 },
                  { x: b.x, y: b.y, vx: b.vx * 0.8, vy: b.vy * 1.2, radius: 5 }
                );
              }
            } else if (pu.type === 'SLOW') {
              ballsRef.current.forEach((b) => {
                b.vx *= 0.75;
                b.vy *= 0.75;
              });
            }
          } else if (pu.y <= CANVAS_HEIGHT) {
            nextPowerUps.push(pu);
          }
        }
        powerUpsRef.current = nextPowerUps;

        // Update Particles
        const nextParticles: Particle[] = [];
        for (const p of particlesRef.current) {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.03;
          if (p.alpha > 0) {
            nextParticles.push(p);
          }
        }
        particlesRef.current = nextParticles;

        // Check Victory
        const aliveBricks = bricksRef.current.filter((b) => b.alive);
        if (aliveBricks.length === 0) {
          sound.playClear();
          setGameState('VICTORY');
          awardAuraWin('Quebra-Blocos');
        }
      }

      // Render Canvas
      renderCanvas(ctx);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    const renderCanvas = (c: CanvasRenderingContext2D) => {
      c.fillStyle = '#060913';
      c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Bricks
      bricksRef.current.forEach((brick) => {
        if (!brick.alive) return;
        c.fillStyle = brick.color;
        c.fillRect(brick.x, brick.y, brick.w, brick.h);

        // Highlight & bevel
        c.fillStyle = 'rgba(255, 255, 255, 0.35)';
        c.fillRect(brick.x, brick.y, brick.w, 2);
        c.fillRect(brick.x, brick.y, 2, brick.h);
        c.fillStyle = 'rgba(0, 0, 0, 0.4)';
        c.fillRect(brick.x, brick.y + brick.h - 2, brick.w, 2);
      });

      // Particles
      particlesRef.current.forEach((p) => {
        c.save();
        c.globalAlpha = p.alpha;
        c.fillStyle = p.color;
        c.fillRect(p.x, p.y, 3, 3);
        c.restore();
      });

      // Powerups
      powerUpsRef.current.forEach((pu) => {
        c.save();
        c.fillStyle = pu.type === 'EXPAND' ? '#38bdf8' : pu.type === 'MULTIBALL' ? '#f43f5e' : '#a855f7';
        c.beginPath();
        c.roundRect(pu.x - 8, pu.y - 6, 16, 12, 4);
        c.fill();
        c.fillStyle = '#ffffff';
        c.font = 'bold 8px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(pu.type[0], pu.x, pu.y);
        c.restore();
      });

      // Balls
      ballsRef.current.forEach((ball) => {
        c.save();
        c.shadowColor = '#fbbf24';
        c.shadowBlur = 10;
        c.fillStyle = '#fbbf24';
        c.beginPath();
        c.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        c.fill();
        c.restore();
      });

      // Paddle
      const px = paddleXRef.current;
      const pw = paddleWidthRef.current;
      const py = CANVAS_HEIGHT - 26;
      c.save();
      c.shadowColor = '#f59e0b';
      c.shadowBlur = 8;
      c.fillStyle = '#f59e0b';
      c.beginPath();
      c.roundRect(px, py, pw, 10, 5);
      c.fill();
      c.restore();

      // Grip line on paddle
      c.fillStyle = '#78350f';
      c.fillRect(px + pw / 2 - 6, py + 3, 12, 4);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState]);

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto">
      {/* Top HUD */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/90 border border-slate-800 rounded-t-xl text-xs font-mono">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-400">PONTOS:</span>{' '}
            <span className="text-lg font-bold text-amber-400 tabular-nums">{score}</span>
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
      <div className="relative w-full aspect-square max-h-[500px] bg-slate-950 border-x border-slate-800 overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          className="w-full h-full block cursor-crosshair touch-none"
        />

        {gameState === 'IDLE' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <h3 className="text-xl font-bold text-white mb-2">Quebra-Blocos</h3>
            <p className="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
              Mova a raquete com o mouse ou as setas. Rebata a bola e capture os poderes para limpar toda a parede!
            </p>
            <button
              onClick={resetGame}
              className="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Jogar Agora
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

        {gameState === 'VICTORY' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="text-emerald-400 font-mono text-sm tracking-widest font-bold mb-1">PARABÉNS!</div>
            <h3 className="text-3xl font-black text-white mb-3">Todos Blocos Destruídos!</h3>
            <p className="text-xs text-slate-300 mb-5 font-mono">Pontuação Final: {score}</p>
            <button
              onClick={resetGame}
              className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Jogar Novamente
            </button>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="text-red-500 font-mono text-sm tracking-widest font-bold mb-1">FIM DE JOGO</div>
            <h3 className="text-3xl font-black text-white mb-3">Todas as Bolas Caíram!</h3>
            <p className="text-xs text-slate-400 mb-5 font-mono">Pontos alcançados: {score}</p>
            <button
              onClick={resetGame}
              className="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Tentar Novamente
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
            Mouse ou Setas Esquerda/Direita para mover
          </span>
        </div>

        <VirtualController
          onDirection={(dir) => {
            if (dir === 'LEFT') paddleXRef.current = Math.max(0, paddleXRef.current - 35);
            if (dir === 'RIGHT') paddleXRef.current = Math.min(CANVAS_WIDTH - paddleWidthRef.current, paddleXRef.current + 35);
          }}
          onActionA={() => {
            if (gameState === 'IDLE' || gameState === 'GAMEOVER') resetGame();
            else setGameState(gameState === 'PLAYING' ? 'PAUSED' : 'PLAYING');
          }}
          actionALabel={gameState === 'PLAYING' ? 'PAUSAR' : 'JOGAR'}
        />
      </div>
    </div>
  );
}
