'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Trophy, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { sound } from '@/lib/sound';
import { getHighScore, saveHighScore } from '@/lib/gameStore';
import { awardAuraWin, triggerDefeat } from '@/lib/auraStore';
import { VirtualController } from '../VirtualController';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };

const GRID_SIZE = 22;
const CELL_COUNT = 22;

export function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'>('IDLE');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => getHighScore('snake'));
  const [snakeLength, setSnakeLength] = useState(3);
  const [mode, setMode] = useState<'CLASSIC' | 'FAST' | 'WRAP'>('CLASSIC');
  const [isNewRecord, setIsNewRecord] = useState(false);

  // Snake internal mutable references for 60fps / tick control
  const snakeRef = useRef<Position[]>([
    { x: 10, y: 10 },
    { x: 10, y: 11 },
    { x: 10, y: 12 },
  ]);
  const dirRef = useRef<Direction>('UP');
  const nextDirRef = useRef<Direction>('UP');
  const foodRef = useRef<Position>({ x: 5, y: 5 });
  const goldenFoodRef = useRef<Position | null>(null);
  const goldenFoodTimerRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  const spawnFood = useCallback(() => {
    const snake = snakeRef.current;
    let newPos: Position;
    while (true) {
      newPos = {
        x: Math.floor(Math.random() * CELL_COUNT),
        y: Math.floor(Math.random() * CELL_COUNT),
      };
      const collides = snake.some((s) => s.x === newPos.x && s.y === newPos.y);
      if (!collides) break;
    }
    foodRef.current = newPos;

    // 25% chance of spawning golden apple if none active
    if (!goldenFoodRef.current && Math.random() < 0.28) {
      let gPos: Position;
      while (true) {
        gPos = {
          x: Math.floor(Math.random() * CELL_COUNT),
          y: Math.floor(Math.random() * CELL_COUNT),
        };
        const collides =
          snake.some((s) => s.x === gPos.x && s.y === gPos.y) ||
          (gPos.x === newPos.x && gPos.y === newPos.y);
        if (!collides) break;
      }
      goldenFoodRef.current = gPos;
      goldenFoodTimerRef.current = 60; // disappears after 60 ticks
    }
  }, []);

  const resetGame = useCallback(() => {
    snakeRef.current = [
      { x: 11, y: 11 },
      { x: 11, y: 12 },
      { x: 11, y: 13 },
    ];
    dirRef.current = 'UP';
    nextDirRef.current = 'UP';
    goldenFoodRef.current = null;
    goldenFoodTimerRef.current = 0;
    setScore(0);
    setSnakeLength(3);
    setIsNewRecord(false);
    spawnFood();
    setGameState('PLAYING');
    sound.playClick();
  }, [spawnFood]);

  const changeDirection = useCallback((newDir: Direction) => {
    const current = dirRef.current;
    if (newDir === 'UP' && current !== 'DOWN') nextDirRef.current = 'UP';
    if (newDir === 'DOWN' && current !== 'UP') nextDirRef.current = 'DOWN';
    if (newDir === 'LEFT' && current !== 'RIGHT') nextDirRef.current = 'LEFT';
    if (newDir === 'RIGHT' && current !== 'LEFT') nextDirRef.current = 'RIGHT';
    sound.playMove();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        if (gameState === 'PLAYING') {
          setGameState('PAUSED');
        } else if (gameState === 'PAUSED' || gameState === 'IDLE') {
          setGameState('PLAYING');
        }
        return;
      }

      if (gameState !== 'PLAYING') return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          changeDirection('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          changeDirection('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          changeDirection('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          changeDirection('RIGHT');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, changeDirection]);

  // Main game tick and draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let baseInterval = mode === 'FAST' ? 85 : 120;
    // Speed increases with score
    const currentInterval = Math.max(55, baseInterval - Math.floor(score / 50) * 5);

    const loop = (timestamp: number) => {
      if (gameState === 'PLAYING') {
        if (timestamp - lastTickRef.current >= currentInterval) {
          lastTickRef.current = timestamp;

          // Process logic tick
          dirRef.current = nextDirRef.current;
          const head = { ...snakeRef.current[0] };

          switch (dirRef.current) {
            case 'UP':
              head.y -= 1;
              break;
            case 'DOWN':
              head.y += 1;
              break;
            case 'LEFT':
              head.x -= 1;
              break;
            case 'RIGHT':
              head.x += 1;
              break;
          }

          // Wall collision or wrap
          if (mode === 'WRAP') {
            if (head.x < 0) head.x = CELL_COUNT - 1;
            if (head.x >= CELL_COUNT) head.x = 0;
            if (head.y < 0) head.y = CELL_COUNT - 1;
            if (head.y >= CELL_COUNT) head.y = 0;
          } else {
            if (
              head.x < 0 ||
              head.x >= CELL_COUNT ||
              head.y < 0 ||
              head.y >= CELL_COUNT
            ) {
              handleGameOver();
              return;
            }
          }

          // Self collision
          const selfCollision = snakeRef.current.some(
            (segment) => segment.x === head.x && segment.y === head.y
          );
          if (selfCollision) {
            handleGameOver();
            return;
          }

          // Move snake
          const newSnake = [head, ...snakeRef.current];

          // Check normal food
          let ateFood = false;
          if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
            ateFood = true;
            const points = mode === 'FAST' ? 15 : 10;
            const newScore = score + points;
            setScore(newScore);
            setSnakeLength((len) => len + 1);
            sound.playEat();
            spawnFood();
          }

          // Check golden food
          if (
            goldenFoodRef.current &&
            head.x === goldenFoodRef.current.x &&
            head.y === goldenFoodRef.current.y
          ) {
            ateFood = true;
            const points = 50;
            const newScore = score + points;
            setScore(newScore);
            setSnakeLength((len) => len + 1);
            goldenFoodRef.current = null;
            sound.playClear();
          }

          // Golden food timer countdown
          if (goldenFoodRef.current) {
            goldenFoodTimerRef.current -= 1;
            if (goldenFoodTimerRef.current <= 0) {
              goldenFoodRef.current = null;
            }
          }

          if (!ateFood) {
            newSnake.pop();
          }
          snakeRef.current = newSnake;
        }
      }

      // Render Canvas
      renderCanvas(ctx, canvas.width, canvas.height);
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    const handleGameOver = () => {
      sound.playGameOver();
      setGameState('GAMEOVER');
      const isNew = saveHighScore('snake', score);
      if (isNew) {
        setIsNewRecord(true);
        setHighScore(score);
      }
      if (score >= 30) {
        awardAuraWin('Cobrinha Clássica');
      } else {
        triggerDefeat('Cobrinha Clássica');
      }
    };

    const renderCanvas = (c: CanvasRenderingContext2D, width: number, height: number) => {
      const cellW = width / CELL_COUNT;
      const cellH = height / CELL_COUNT;

      // Dark retro grid background
      c.fillStyle = '#090d16';
      c.fillRect(0, 0, width, height);

      // Grid lines
      c.strokeStyle = '#151d2f';
      c.lineWidth = 1;
      for (let i = 0; i <= CELL_COUNT; i++) {
        c.beginPath();
        c.moveTo(i * cellW, 0);
        c.lineTo(i * cellW, height);
        c.stroke();

        c.beginPath();
        c.moveTo(0, i * cellH);
        c.lineTo(width, i * cellH);
        c.stroke();
      }

      // Draw Normal Food (Red Apple with stem)
      const food = foodRef.current;
      const foodCenterX = (food.x + 0.5) * cellW;
      const foodCenterY = (food.y + 0.5) * cellH;
      const foodRadius = cellW * 0.4;

      c.save();
      c.shadowColor = '#ef4444';
      c.shadowBlur = 10;
      c.fillStyle = '#ef4444';
      c.beginPath();
      c.arc(foodCenterX, foodCenterY, foodRadius, 0, Math.PI * 2);
      c.fill();
      c.restore();

      // Apple leaf/stem
      c.fillStyle = '#22c55e';
      c.fillRect(foodCenterX - 1, foodCenterY - foodRadius - 2, 2, 4);

      // Draw Golden Apple if present
      if (goldenFoodRef.current) {
        const gFood = goldenFoodRef.current;
        const gCenterX = (gFood.x + 0.5) * cellW;
        const gCenterY = (gFood.y + 0.5) * cellH;
        const pulse = Math.sin(Date.now() / 150) * 2;
        const gRadius = cellW * 0.44 + pulse;

        c.save();
        c.shadowColor = '#fbbf24';
        c.shadowBlur = 15;
        c.fillStyle = '#fbbf24';
        c.beginPath();
        c.arc(gCenterX, gCenterY, Math.max(2, gRadius), 0, Math.PI * 2);
        c.fill();
        c.restore();

        // Little star sparkle
        c.fillStyle = '#ffffff';
        c.fillRect(gCenterX - 2, gCenterY - 2, 4, 4);
      }

      // Draw Snake
      const snake = snakeRef.current;
      snake.forEach((segment, index) => {
        const isHead = index === 0;
        const segX = segment.x * cellW + 1;
        const segY = segment.y * cellH + 1;
        const segW = cellW - 2;
        const segH = cellH - 2;

        if (isHead) {
          c.save();
          c.shadowColor = '#22c55e';
          c.shadowBlur = 12;
          c.fillStyle = '#4ade80';
          c.beginPath();
          c.roundRect(segX, segY, segW, segH, 6);
          c.fill();
          c.restore();

          // Snake Eyes
          c.fillStyle = '#090d16';
          const eyeSize = 3;
          let eye1 = { x: segX + 4, y: segY + 4 };
          let eye2 = { x: segX + segW - 7, y: segY + 4 };

          if (dirRef.current === 'DOWN') {
            eye1 = { x: segX + 4, y: segY + segH - 7 };
            eye2 = { x: segX + segW - 7, y: segY + segH - 7 };
          } else if (dirRef.current === 'LEFT') {
            eye1 = { x: segX + 4, y: segY + 4 };
            eye2 = { x: segX + 4, y: segY + segH - 7 };
          } else if (dirRef.current === 'RIGHT') {
            eye1 = { x: segX + segW - 7, y: segY + 4 };
            eye2 = { x: segX + segW - 7, y: segY + segH - 7 };
          }

          c.fillRect(eye1.x, eye1.y, eyeSize, eyeSize);
          c.fillRect(eye2.x, eye2.y, eyeSize, eyeSize);
        } else {
          // Body gradient shading
          const factor = Math.max(0.4, 1 - index / (snake.length + 10));
          c.fillStyle = `rgb(34, ${Math.floor(197 * factor)}, 94)`;
          c.beginPath();
          c.roundRect(segX, segY, segW, segH, 4);
          c.fill();
        }
      });
    };

    animationFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameState, mode, score, spawnFood]);

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto">
      {/* Top HUD */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/90 border border-slate-800 rounded-t-xl">
        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-slate-400">PONTUAÇÃO:</span>{' '}
            <span className="text-lg font-bold text-emerald-400 tabular-nums">{score}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
            <span>COMPRIMENTO:</span>
            <span className="font-bold text-slate-200 tabular-nums">{snakeLength}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono text-amber-400 bg-amber-950/30 px-2.5 py-1 rounded border border-amber-800/40">
            <Trophy className="w-3.5 h-3.5" />
            <span className="font-bold tabular-nums">{highScore}</span>
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setMode('CLASSIC')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                mode === 'CLASSIC' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Padrão
            </button>
            <button
              onClick={() => setMode('FAST')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                mode === 'FAST' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Turbo
            </button>
            <button
              onClick={() => setMode('WRAP')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                mode === 'WRAP' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sem Borda
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="relative w-full aspect-square bg-slate-950 border-x border-slate-800 overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={440}
          height={440}
          className="w-full h-full block"
        />

        {/* Start Overlay */}
        {gameState === 'IDLE' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/10">
              <Sparkles className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Cobrinha Clássica</h3>
            <p className="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
              Use as setas ou WASD para guiar a cobra. Devore maçãs vermelhas (+10) e maçãs douradas raras (+50).
            </p>
            <button
              onClick={resetGame}
              className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Iniciar Partida
            </button>
          </div>
        )}

        {/* Paused Overlay */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <h3 className="text-2xl font-bold text-amber-400 mb-2">JOGO PAUSADO</h3>
            <p className="text-xs text-slate-400 mb-5">Pressione Espaço ou clique abaixo para continuar</p>
            <button
              onClick={() => setGameState('PLAYING')}
              className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm flex items-center gap-2 border border-slate-700 transition-colors"
            >
              <Play className="w-4 h-4 fill-current" />
              Continuar
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="text-red-500 font-mono text-sm tracking-widest font-bold mb-1">FIM DE JOGO</div>
            <h3 className="text-3xl font-black text-white mb-2">A Cobra Bateu!</h3>

            {isNewRecord && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/50 rounded-full text-amber-300 text-xs font-semibold mb-3 animate-bounce">
                <Trophy className="w-3.5 h-3.5" />
                NOVO RECORDE REGISTRADO!
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 w-64 mb-6 text-left text-xs font-mono space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Pontuação Final:</span>
                <span className="text-emerald-400 font-bold tabular-nums">{score}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tamanho da Cobra:</span>
                <span className="text-slate-200 font-bold tabular-nums">{snakeLength}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Melhor Recorde:</span>
                <span className="text-amber-400 font-bold tabular-nums">{highScore}</span>
              </div>
            </div>

            <button
              onClick={resetGame}
              className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Jogar Novamente
            </button>
          </div>
        )}
      </div>

      {/* Bottom Bar: Action buttons & mobile controller */}
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
            Teclas: Setas / WASD · Espaço = Pausa
          </span>
        </div>

        {/* Virtual touch controls for mobile */}
        <VirtualController
          onDirection={changeDirection}
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
