'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Trophy, Users, User } from 'lucide-react';
import { sound } from '@/lib/sound';
import { getHighScore, saveHighScore } from '@/lib/gameStore';
import { awardAuraWin, triggerDefeat } from '@/lib/auraStore';

type GameMode = '1P_EASY' | '1P_NORMAL' | '1P_HARD' | '2P_LOCAL';

const CANVAS_WIDTH = 560;
const CANVAS_HEIGHT = 400;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 65;
const BALL_SIZE = 8;
const WINNING_SCORE = 7;

export function PongGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'>('IDLE');
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [rallyCount, setRallyCount] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => getHighScore('pong')); // highest rally
  const [mode, setMode] = useState<GameMode>('1P_NORMAL');
  const [winner, setWinner] = useState<string | null>(null);

  // Mutable refs
  const p1YRef = useRef(CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2);
  const p2YRef = useRef(CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2);
  const ballRef = useRef<{ x: number; y: number; vx: number; vy: number; speed: number }>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    vx: 4.5,
    vy: 2.5,
    speed: 5,
  });
  const currentRallyRef = useRef(0);
  const keysPressedRef = useRef<Record<string, boolean>>({});
  const animFrameRef = useRef<number | null>(null);

  const resetBall = useCallback((towardP2: boolean) => {
    const angle = (Math.random() * 0.8 - 0.4) * Math.PI; // -0.4 to 0.4 radians
    const dir = towardP2 ? 1 : -1;
    const speed = 4.8;
    ballRef.current = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      vx: dir * speed * Math.cos(angle),
      vy: speed * Math.sin(angle),
      speed,
    };
    currentRallyRef.current = 0;
    setRallyCount(0);
  }, []);

  const resetGame = useCallback(() => {
    p1YRef.current = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    p2YRef.current = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    setP1Score(0);
    setP2Score(0);
    setWinner(null);
    resetBall(Math.random() > 0.5);
    setGameState('PLAYING');
    sound.playClick();
  }, [resetBall]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S', ' '].includes(e.key)) {
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

  // Main Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      if (gameState === 'PLAYING') {
        const keys = keysPressedRef.current;
        const paddleSpeed = 6.5;

        // Player 1 movement (W/S or Up/Down in 1P mode)
        if (keys['w'] || keys['W'] || (mode !== '2P_LOCAL' && (keys['ArrowUp']))) {
          p1YRef.current = Math.max(0, p1YRef.current - paddleSpeed);
        }
        if (keys['s'] || keys['S'] || (mode !== '2P_LOCAL' && (keys['ArrowDown']))) {
          p1YRef.current = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, p1YRef.current + paddleSpeed);
        }

        // Player 2 movement
        if (mode === '2P_LOCAL') {
          if (keys['ArrowUp']) {
            p2YRef.current = Math.max(0, p2YRef.current - paddleSpeed);
          }
          if (keys['ArrowDown']) {
            p2YRef.current = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, p2YRef.current + paddleSpeed);
          }
        } else {
          // AI Logic
          const ball = ballRef.current;
          const aiCenter = p2YRef.current + PADDLE_HEIGHT / 2;
          const diff = ball.y - aiCenter;

          let aiSpeed = 3.8;
          let reactionMargin = 16;
          if (mode === '1P_EASY') {
            aiSpeed = 2.8;
            reactionMargin = 26;
          } else if (mode === '1P_HARD') {
            aiSpeed = 5.2;
            reactionMargin = 8;
          }

          if (ball.vx > 0) {
            // Ball moving toward AI
            if (Math.abs(diff) > reactionMargin) {
              p2YRef.current += Math.sign(diff) * aiSpeed;
              p2YRef.current = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, p2YRef.current));
            }
          }
        }

        // Ball movement
        const ball = ballRef.current;
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Top & Bottom boundary bounce
        if (ball.y - BALL_SIZE / 2 <= 0) {
          ball.y = BALL_SIZE / 2;
          ball.vy = Math.abs(ball.vy);
          sound.playBounce();
        } else if (ball.y + BALL_SIZE / 2 >= CANVAS_HEIGHT) {
          ball.y = CANVAS_HEIGHT - BALL_SIZE / 2;
          ball.vy = -Math.abs(ball.vy);
          sound.playBounce();
        }

        // Left Paddle (Player 1) Collision
        const p1X = 25;
        if (
          ball.x - BALL_SIZE / 2 <= p1X + PADDLE_WIDTH &&
          ball.x + BALL_SIZE / 2 >= p1X &&
          ball.y >= p1YRef.current &&
          ball.y <= p1YRef.current + PADDLE_HEIGHT &&
          ball.vx < 0
        ) {
          const hitOffset = (ball.y - (p1YRef.current + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
          ball.speed = Math.min(10, ball.speed + 0.25);
          const angle = hitOffset * (Math.PI / 3.5);
          ball.vx = ball.speed * Math.cos(angle);
          ball.vy = ball.speed * Math.sin(angle);
          ball.x = p1X + PADDLE_WIDTH + BALL_SIZE / 2;

          currentRallyRef.current += 1;
          setRallyCount(currentRallyRef.current);
          saveHighScore('pong', currentRallyRef.current);
          setHighScore((prev) => Math.max(prev, currentRallyRef.current));
          sound.playBounce();
        }

        // Right Paddle (Player 2 / AI) Collision
        const p2X = CANVAS_WIDTH - 25 - PADDLE_WIDTH;
        if (
          ball.x + BALL_SIZE / 2 >= p2X &&
          ball.x - BALL_SIZE / 2 <= p2X + PADDLE_WIDTH &&
          ball.y >= p2YRef.current &&
          ball.y <= p2YRef.current + PADDLE_HEIGHT &&
          ball.vx > 0
        ) {
          const hitOffset = (ball.y - (p2YRef.current + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
          ball.speed = Math.min(10, ball.speed + 0.25);
          const angle = hitOffset * (Math.PI / 3.5);
          ball.vx = -ball.speed * Math.cos(angle);
          ball.vy = ball.speed * Math.sin(angle);
          ball.x = p2X - BALL_SIZE / 2;

          currentRallyRef.current += 1;
          setRallyCount(currentRallyRef.current);
          saveHighScore('pong', currentRallyRef.current);
          setHighScore((prev) => Math.max(prev, currentRallyRef.current));
          sound.playBounce();
        }

        // Score check
        if (ball.x < 0) {
          // Player 2 scored
          sound.playGameOver();
          setP2Score((s) => {
            const next = s + 1;
            if (next >= WINNING_SCORE) {
              setWinner(mode === '2P_LOCAL' ? 'Jogador 2' : 'Computador');
              setGameState('GAMEOVER');
              if (mode !== '2P_LOCAL') {
                triggerDefeat('Tênis Retrô (Pong)');
              }
            } else {
              resetBall(true);
            }
            return next;
          });
        } else if (ball.x > CANVAS_WIDTH) {
          // Player 1 scored
          sound.playClear();
          setP1Score((s) => {
            const next = s + 1;
            if (next >= WINNING_SCORE) {
              setWinner(mode === '2P_LOCAL' ? 'Jogador 1' : 'Você');
              setGameState('GAMEOVER');
              const auraDiff = mode === '1P_HARD' ? 'DIFICIL' : mode === '1P_EASY' ? 'FACIL' : 'MEDIO';
              awardAuraWin('Tênis Retrô (Pong)', auraDiff);
            } else {
              resetBall(false);
            }
            return next;
          });
        }
      }

      // Render
      renderCanvas(ctx);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    const renderCanvas = (c: CanvasRenderingContext2D) => {
      c.fillStyle = '#060913';
      c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Center dashed net line
      c.strokeStyle = '#1e293b';
      c.lineWidth = 3;
      c.setLineDash([8, 8]);
      c.beginPath();
      c.moveTo(CANVAS_WIDTH / 2, 0);
      c.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
      c.stroke();
      c.setLineDash([]);

      // Retro Big Score in Center Background
      c.font = 'bold 54px monospace';
      c.fillStyle = 'rgba(255, 255, 255, 0.08)';
      c.textAlign = 'center';
      c.fillText(String(p1Score), CANVAS_WIDTH / 2 - 70, 70);
      c.fillText(String(p2Score), CANVAS_WIDTH / 2 + 70, 70);

      // Player 1 Paddle
      c.save();
      c.shadowColor = '#a855f7';
      c.shadowBlur = 10;
      c.fillStyle = '#c084fc';
      c.fillRect(25, p1YRef.current, PADDLE_WIDTH, PADDLE_HEIGHT);
      c.restore();

      // Player 2 Paddle
      c.save();
      c.shadowColor = '#38bdf8';
      c.shadowBlur = 10;
      c.fillStyle = '#38bdf8';
      c.fillRect(CANVAS_WIDTH - 25 - PADDLE_WIDTH, p2YRef.current, PADDLE_WIDTH, PADDLE_HEIGHT);
      c.restore();

      // Ball
      const ball = ballRef.current;
      c.save();
      c.shadowColor = '#facc15';
      c.shadowBlur = 12;
      c.fillStyle = '#fef08a';
      c.fillRect(ball.x - BALL_SIZE / 2, ball.y - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE);
      c.restore();
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState, mode, resetBall, p1Score, p2Score]);

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto">
      {/* Top HUD */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/90 border border-slate-800 rounded-t-xl text-xs font-mono">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-purple-400 font-bold">{mode === '2P_LOCAL' ? 'JOGADOR 1' : 'VOCÊ'}:</span>
            <span className="text-lg font-bold text-white tabular-nums">{p1Score}</span>
          </div>
          <span className="text-slate-600 font-bold">VS</span>
          <div className="flex items-center gap-2">
            <span className="text-sky-400 font-bold">{mode === '2P_LOCAL' ? 'JOGADOR 2' : 'IA'}:</span>
            <span className="text-lg font-bold text-white tabular-nums">{p2Score}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/30 px-2.5 py-1 rounded border border-amber-800/40">
            <Trophy className="w-3.5 h-3.5" />
            <span className="font-bold tabular-nums">Rally: {rallyCount}</span>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
            <button
              onClick={() => { setMode('1P_EASY'); resetGame(); }}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                mode === '1P_EASY' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              IA Fácil
            </button>
            <button
              onClick={() => { setMode('1P_NORMAL'); resetGame(); }}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                mode === '1P_NORMAL' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              IA Normal
            </button>
            <button
              onClick={() => { setMode('2P_LOCAL'); resetGame(); }}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                mode === '2P_LOCAL' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              2 Jogadores
            </button>
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative w-full aspect-[560/400] max-h-[460px] bg-slate-950 border-x border-slate-800 overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full block"
        />

        {gameState === 'IDLE' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <h3 className="text-xl font-bold text-white mb-2">Tênis Retrô (Pong)</h3>
            <p className="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
              Dispute pontos contra a máquina ou desafie um amigo no mesmo teclado! Primeiro a 7 pontos vence a partida.
            </p>
            <button
              onClick={resetGame}
              className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-600/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Sacar e Jogar
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
            <div className="text-purple-400 font-mono text-sm tracking-widest font-bold mb-1">PARTIDA ENCERRADA</div>
            <h3 className="text-3xl font-black text-white mb-2">{winner} Venceu!</h3>
            <p className="text-xs text-slate-400 mb-6 font-mono">
              Placar Final: {p1Score} x {p2Score} · Maior Rally: {highScore} trocas
            </p>
            <button
              onClick={resetGame}
              className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-600/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Revanche
            </button>
          </div>
        )}
      </div>

      {/* Touch & Controls Bar */}
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
            {mode === '2P_LOCAL' ? 'J1: W/S · J2: Setas Cima/Baixo' : 'Use W/S ou Setas Cima/Baixo'}
          </span>
        </div>

        {/* Quick Touch Paddle Buttons for Mobile */}
        <div className="grid grid-cols-2 gap-4 p-2 bg-slate-950/60 rounded-lg border border-slate-800 text-xs">
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-mono text-purple-400 font-bold">J1 (SUBIR / DESCER)</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  p1YRef.current = Math.max(0, p1YRef.current - 35);
                  sound.playMove();
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-purple-600 rounded text-white font-bold"
              >
                ▲ Cima
              </button>
              <button
                type="button"
                onClick={() => {
                  p1YRef.current = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, p1YRef.current + 35);
                  sound.playMove();
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-purple-600 rounded text-white font-bold"
              >
                ▼ Baixo
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-mono text-sky-400 font-bold">
              {mode === '2P_LOCAL' ? 'J2 (SUBIR / DESCER)' : 'AÇÃO'}
            </span>
            <div className="flex gap-2">
              {mode === '2P_LOCAL' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      p2YRef.current = Math.max(0, p2YRef.current - 35);
                      sound.playMove();
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-sky-600 rounded text-white font-bold"
                  >
                    ▲ Cima
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      p2YRef.current = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, p2YRef.current + 35);
                      sound.playMove();
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-sky-600 rounded text-white font-bold"
                  >
                    ▼ Baixo
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={resetGame}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded text-white font-bold"
                >
                  Novo Saque
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
