'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Trophy, Layers, ArrowDownToLine } from 'lucide-react';
import { sound } from '@/lib/sound';
import { getHighScore, saveHighScore } from '@/lib/gameStore';
import { awardAuraWin } from '@/lib/auraStore';
import { VirtualController } from '../VirtualController';

const COLS = 10;
const ROWS = 20;

// Tetromino definitions
type ShapeType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

interface Tetromino {
  type: ShapeType;
  color: string;
  matrix: number[][];
}

const SHAPES: Record<ShapeType, { color: string; matrix: number[][] }> = {
  I: {
    color: '#06b6d4', // Cyan
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  J: {
    color: '#3b82f6', // Blue
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  L: {
    color: '#f97316', // Orange
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  O: {
    color: '#eab308', // Yellow
    matrix: [
      [1, 1],
      [1, 1],
    ],
  },
  S: {
    color: '#22c55e', // Green
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
  },
  T: {
    color: '#a855f7', // Purple
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  Z: {
    color: '#ef4444', // Red
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
};

const SHAPE_KEYS: ShapeType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

function getRandomPiece(): Tetromino {
  const type = SHAPE_KEYS[Math.floor(Math.random() * SHAPE_KEYS.length)];
  return {
    type,
    color: SHAPES[type].color,
    matrix: SHAPES[type].matrix.map((row) => [...row]),
  };
}

function rotateMatrix(matrix: number[][]): number[][] {
  const N = matrix.length;
  const result: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      result[c][N - 1 - r] = matrix[r][c];
    }
  }
  return result;
}

export function TetrisGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'>('IDLE');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => getHighScore('tetris'));
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [nextPiece, setNextPiece] = useState<Tetromino | null>(null);
  const [holdPiece, setHoldPiece] = useState<Tetromino | null>(null);
  const [canHold, setCanHold] = useState(true);

  // Mutable game state refs for loop
  const boardRef = useRef<string[][]>(
    Array.from({ length: ROWS }, () => Array(COLS).fill(''))
  );
  const currentPieceRef = useRef<Tetromino | null>(null);
  const piecePosRef = useRef<{ x: number; y: number }>({ x: 3, y: 0 });
  const nextPieceRef = useRef<Tetromino | null>(null);
  const holdPieceRef = useRef<Tetromino | null>(null);
  const canHoldRef = useRef(true);
  const lastDropTimeRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  const checkCollision = (piece: Tetromino, pos: { x: number; y: number }, board: string[][]): boolean => {
    const { matrix } = piece;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const boardX = pos.x + c;
          const boardY = pos.y + r;
          if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
            return true;
          }
          if (boardY >= 0 && board[boardY][boardX] !== '') {
            return true;
          }
        }
      }
    }
    return false;
  };

  const getGhostY = useCallback((): number => {
    if (!currentPieceRef.current) return 0;
    const piece = currentPieceRef.current;
    const pos = { ...piecePosRef.current };
    const board = boardRef.current;

    while (!checkCollision(piece, { x: pos.x, y: pos.y + 1 }, board)) {
      pos.y += 1;
    }
    return pos.y;
  }, []);

  const spawnNewPiece = useCallback(() => {
    const next = nextPieceRef.current || getRandomPiece();
    const futureNext = getRandomPiece();
    nextPieceRef.current = futureNext;
    setNextPiece(futureNext);

    currentPieceRef.current = next;
    piecePosRef.current = {
      x: Math.floor((COLS - next.matrix[0].length) / 2),
      y: 0,
    };
    canHoldRef.current = true;
    setCanHold(true);

    // If instantly collides -> game over
    if (checkCollision(next, piecePosRef.current, boardRef.current)) {
      sound.playGameOver();
      setGameState('GAMEOVER');
      setScore((s) => {
        saveHighScore('tetris', s);
        return s;
      });
    }
  }, []);

  const resetGame = useCallback(() => {
    boardRef.current = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
    const first = getRandomPiece();
    const second = getRandomPiece();
    currentPieceRef.current = first;
    piecePosRef.current = {
      x: Math.floor((COLS - first.matrix[0].length) / 2),
      y: 0,
    };
    nextPieceRef.current = second;
    setNextPiece(second);
    holdPieceRef.current = null;
    setHoldPiece(null);
    canHoldRef.current = true;
    setCanHold(true);

    setScore(0);
    setLines(0);
    setLevel(1);
    setGameState('PLAYING');
    sound.playClick();
  }, []);

  const lockPiece = useCallback(() => {
    const piece = currentPieceRef.current;
    if (!piece) return;
    const pos = piecePosRef.current;
    const board = boardRef.current;

    // Lock cells into board
    for (let r = 0; r < piece.matrix.length; r++) {
      for (let c = 0; c < piece.matrix[r].length; c++) {
        if (piece.matrix[r][c] !== 0) {
          const boardY = pos.y + r;
          const boardX = pos.x + c;
          if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
            board[boardY][boardX] = piece.color;
          }
        }
      }
    }

    sound.playBounce();

    // Check full lines
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((cell) => cell !== '')) {
        cleared += 1;
        board.splice(r, 1);
        board.unshift(Array(COLS).fill(''));
        r++; // check same index again since lines shifted down
      }
    }

    if (cleared > 0) {
      sound.playClear();
      const linePoints = [0, 100, 300, 500, 800];
      setScore((prev) => {
        const gained = (linePoints[cleared] || 100) * level;
        const total = prev + gained;
        saveHighScore('tetris', total);
        return total;
      });
      setLines((prev) => {
        const totalLines = prev + cleared;
        const newLevel = Math.floor(totalLines / 10) + 1;
        if (newLevel > level || cleared >= 4) {
          awardAuraWin('Tetris Retrô');
        }
        setLevel(newLevel);
        return totalLines;
      });
    }

    spawnNewPiece();
  }, [level, spawnNewPiece]);

  const moveLeft = useCallback(() => {
    if (!currentPieceRef.current || gameState !== 'PLAYING') return;
    const pos = piecePosRef.current;
    if (!checkCollision(currentPieceRef.current, { x: pos.x - 1, y: pos.y }, boardRef.current)) {
      pos.x -= 1;
      sound.playMove();
    }
  }, [gameState]);

  const moveRight = useCallback(() => {
    if (!currentPieceRef.current || gameState !== 'PLAYING') return;
    const pos = piecePosRef.current;
    if (!checkCollision(currentPieceRef.current, { x: pos.x + 1, y: pos.y }, boardRef.current)) {
      pos.x += 1;
      sound.playMove();
    }
  }, [gameState]);

  const rotate = useCallback(() => {
    if (!currentPieceRef.current || gameState !== 'PLAYING') return;
    const piece = currentPieceRef.current;
    const rotated = rotateMatrix(piece.matrix);
    const newPiece = { ...piece, matrix: rotated };
    const pos = piecePosRef.current;

    // Normal rotation or simple wall kicks
    if (!checkCollision(newPiece, pos, boardRef.current)) {
      currentPieceRef.current = newPiece;
      sound.playMove();
    } else if (!checkCollision(newPiece, { x: pos.x - 1, y: pos.y }, boardRef.current)) {
      pos.x -= 1;
      currentPieceRef.current = newPiece;
      sound.playMove();
    } else if (!checkCollision(newPiece, { x: pos.x + 1, y: pos.y }, boardRef.current)) {
      pos.x += 1;
      currentPieceRef.current = newPiece;
      sound.playMove();
    }
  }, [gameState]);

  const softDrop = useCallback(() => {
    if (!currentPieceRef.current || gameState !== 'PLAYING') return;
    const pos = piecePosRef.current;
    if (!checkCollision(currentPieceRef.current, { x: pos.x, y: pos.y + 1 }, boardRef.current)) {
      pos.y += 1;
      setScore((s) => s + 1);
    } else {
      lockPiece();
    }
  }, [gameState, lockPiece]);

  const hardDrop = useCallback(() => {
    if (!currentPieceRef.current || gameState !== 'PLAYING') return;
    const ghostY = getGhostY();
    const droppedDistance = ghostY - piecePosRef.current.y;
    piecePosRef.current.y = ghostY;
    setScore((s) => s + droppedDistance * 2);
    lockPiece();
  }, [gameState, getGhostY, lockPiece]);

  const holdCurrent = useCallback(() => {
    if (!currentPieceRef.current || !canHoldRef.current || gameState !== 'PLAYING') return;
    const current = currentPieceRef.current;
    const existingHold = holdPieceRef.current;

    sound.playMove();
    holdPieceRef.current = {
      type: current.type,
      color: SHAPES[current.type].color,
      matrix: SHAPES[current.type].matrix.map((row) => [...row]),
    };
    setHoldPiece(holdPieceRef.current);
    canHoldRef.current = false;
    setCanHold(false);

    if (existingHold) {
      currentPieceRef.current = existingHold;
      piecePosRef.current = {
        x: Math.floor((COLS - existingHold.matrix[0].length) / 2),
        y: 0,
      };
    } else {
      spawnNewPiece();
    }
  }, [gameState, spawnNewPiece]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'p' || e.key === 'P') {
        setGameState((s) => (s === 'PLAYING' ? 'PAUSED' : s === 'PAUSED' ? 'PLAYING' : s));
        return;
      }

      if (gameState !== 'PLAYING') return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          moveLeft();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          moveRight();
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
        case 'x':
        case 'X':
          rotate();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          softDrop();
          break;
        case ' ':
          hardDrop();
          break;
        case 'c':
        case 'C':
        case 'Shift':
          holdCurrent();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, moveLeft, moveRight, rotate, softDrop, hardDrop, holdCurrent]);

  // Main Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dropSpeed = Math.max(90, 800 - (level - 1) * 70);

    const loop = (time: number) => {
      if (gameState === 'PLAYING') {
        if (time - lastDropTimeRef.current >= dropSpeed) {
          lastDropTimeRef.current = time;
          if (currentPieceRef.current) {
            const pos = piecePosRef.current;
            if (!checkCollision(currentPieceRef.current, { x: pos.x, y: pos.y + 1 }, boardRef.current)) {
              pos.y += 1;
            } else {
              lockPiece();
            }
          }
        }
      }

      // Draw game
      renderCanvas(ctx, canvas.width, canvas.height);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    const renderCanvas = (c: CanvasRenderingContext2D, width: number, height: number) => {
      const cellW = width / COLS;
      const cellH = height / ROWS;

      c.fillStyle = '#080c14';
      c.fillRect(0, 0, width, height);

      // Grid
      c.strokeStyle = '#141c2c';
      c.lineWidth = 1;
      for (let x = 0; x <= COLS; x++) {
        c.beginPath();
        c.moveTo(x * cellW, 0);
        c.lineTo(x * cellW, height);
        c.stroke();
      }
      for (let y = 0; y <= ROWS; y++) {
        c.beginPath();
        c.moveTo(0, y * cellH);
        c.lineTo(width, y * cellH);
        c.stroke();
      }

      // Draw locked board blocks
      const board = boardRef.current;
      for (let r = 0; r < ROWS; r++) {
        for (let col = 0; col < COLS; col++) {
          if (board[r][col]) {
            drawBlock(c, col * cellW, r * cellH, cellW, cellH, board[r][col]);
          }
        }
      }

      // Draw Ghost Piece
      if (currentPieceRef.current && gameState === 'PLAYING') {
        const piece = currentPieceRef.current;
        const ghostY = getGhostY();
        const pos = piecePosRef.current;

        c.save();
        c.globalAlpha = 0.28;
        for (let r = 0; r < piece.matrix.length; r++) {
          for (let col = 0; col < piece.matrix[r].length; col++) {
            if (piece.matrix[r][col] !== 0) {
              drawBlock(c, (pos.x + col) * cellW, (ghostY + r) * cellH, cellW, cellH, piece.color, true);
            }
          }
        }
        c.restore();
      }

      // Draw Current Piece
      if (currentPieceRef.current && (gameState === 'PLAYING' || gameState === 'PAUSED')) {
        const piece = currentPieceRef.current;
        const pos = piecePosRef.current;

        for (let r = 0; r < piece.matrix.length; r++) {
          for (let col = 0; col < piece.matrix[r].length; col++) {
            if (piece.matrix[r][col] !== 0) {
              drawBlock(c, (pos.x + col) * cellW, (pos.y + r) * cellH, cellW, cellH, piece.color);
            }
          }
        }
      }
    };

    const drawBlock = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      color: string,
      ghost = false
    ) => {
      c.fillStyle = color;
      if (ghost) {
        c.strokeStyle = color;
        c.lineWidth = 1.5;
        c.strokeRect(x + 2, y + 2, w - 4, h - 4);
        return;
      }
      c.fillRect(x + 1, y + 1, w - 2, h - 2);

      // Bevel highlight & shadow for 3D retro brick feel
      c.fillStyle = 'rgba(255, 255, 255, 0.35)';
      c.fillRect(x + 1, y + 1, w - 2, 2);
      c.fillRect(x + 1, y + 1, 2, h - 2);

      c.fillStyle = 'rgba(0, 0, 0, 0.35)';
      c.fillRect(x + 1, y + h - 3, w - 2, 2);
      c.fillRect(x + w - 3, y + 1, 2, h - 2);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState, level, getGhostY, lockPiece]);

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto">
      {/* Top HUD */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/90 border border-slate-800 rounded-t-xl text-xs font-mono">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-400">PONTOS:</span>{' '}
            <span className="text-lg font-bold text-cyan-400 tabular-nums">{score}</span>
          </div>
          <div>
            <span className="text-slate-400">NÍVEL:</span>{' '}
            <span className="font-bold text-amber-400 tabular-nums">{level}</span>
          </div>
          <div>
            <span className="text-slate-400">LINHAS:</span>{' '}
            <span className="font-bold text-slate-200 tabular-nums">{lines}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/30 px-2.5 py-1 rounded border border-amber-800/40">
          <Trophy className="w-3.5 h-3.5" />
          <span className="font-bold tabular-nums">{highScore}</span>
        </div>
      </div>

      {/* Main Play Area with Side Panels */}
      <div className="relative w-full flex bg-slate-950 border-x border-slate-800">
        {/* Left Panel: Hold */}
        <div className="w-24 p-2 bg-slate-950/90 border-r border-slate-850 flex flex-col items-center gap-4 text-[10px] font-mono text-slate-400">
          <div className="w-full text-center">
            <span className="tracking-wider">RESERVA</span>
            <div className="w-16 h-16 mt-1 mx-auto bg-slate-900 border border-slate-800 rounded flex items-center justify-center p-1">
              {holdPiece ? (
                <div
                  className="grid gap-0.5"
                  style={{
                    gridTemplateColumns: `repeat(${holdPiece.matrix[0].length}, 10px)`,
                  }}
                >
                  {holdPiece.matrix.map((row, r) =>
                    row.map((cell, c) => (
                      <div
                        key={`${r}-${c}`}
                        className="w-2.5 h-2.5 rounded-xs"
                        style={{
                          backgroundColor: cell ? holdPiece.color : 'transparent',
                        }}
                      />
                    ))
                  )}
                </div>
              ) : (
                <span className="text-slate-700 text-[10px]">C / Shift</span>
              )}
            </div>
            <button
              onClick={holdCurrent}
              disabled={!canHold || gameState !== 'PLAYING'}
              className="mt-2 w-full py-1 text-[10px] bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded font-medium transition-colors"
            >
              Guardar
            </button>
          </div>
        </div>

        {/* Center Canvas */}
        <div className="relative flex-1 aspect-[10/20] max-h-[500px] flex items-center justify-center bg-slate-950">
          <canvas
            ref={canvasRef}
            width={280}
            height={560}
            className="w-full h-full block"
          />

          {gameState === 'IDLE' && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
              <h3 className="text-xl font-bold text-white mb-2">Blocos Retrô</h3>
              <p className="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
                Empilhe os blocos sem deixar chegar ao topo! Use Espaço para queda rápida e C para guardar peça.
              </p>
              <button
                onClick={resetGame}
                className="px-6 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 active:scale-95 transition-all flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                Iniciar Partida
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
              <div className="text-red-500 font-mono text-sm tracking-widest font-bold mb-1">FIM DE JOGO</div>
              <h3 className="text-3xl font-black text-white mb-3">Topo Atingido!</h3>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 w-56 mb-5 text-left text-xs font-mono space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Pontos:</span>
                  <span className="text-cyan-400 font-bold tabular-nums">{score}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Linhas:</span>
                  <span className="text-slate-200 font-bold tabular-nums">{lines}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Nível:</span>
                  <span className="text-amber-400 font-bold tabular-nums">{level}</span>
                </div>
              </div>

              <button
                onClick={resetGame}
                className="px-6 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 active:scale-95 transition-all flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Jogar Novamente
              </button>
            </div>
          )}
        </div>

        {/* Right Panel: Next Piece */}
        <div className="w-24 p-2 bg-slate-950/90 border-l border-slate-850 flex flex-col items-center gap-4 text-[10px] font-mono text-slate-400">
          <div className="w-full text-center">
            <span className="tracking-wider">PRÓXIMA</span>
            <div className="w-16 h-16 mt-1 mx-auto bg-slate-900 border border-slate-800 rounded flex items-center justify-center p-1">
              {nextPiece && (
                <div
                  className="grid gap-0.5"
                  style={{
                    gridTemplateColumns: `repeat(${nextPiece.matrix[0].length}, 10px)`,
                  }}
                >
                  {nextPiece.matrix.map((row, r) =>
                    row.map((cell, c) => (
                      <div
                        key={`${r}-${c}`}
                        className="w-2.5 h-2.5 rounded-xs"
                        style={{
                          backgroundColor: cell ? nextPiece.color : 'transparent',
                        }}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={hardDrop}
            disabled={gameState !== 'PLAYING'}
            className="w-full py-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded font-semibold text-[10px] hover:bg-amber-500/30 active:scale-95 transition-all flex flex-col items-center gap-1"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>SOLTAR</span>
          </button>
        </div>
      </div>

      {/* Bottom Controls */}
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
            Espaço: Queda rápida · C/Shift: Hold
          </span>
        </div>

        <VirtualController
          onDirection={(dir) => {
            if (dir === 'LEFT') moveLeft();
            if (dir === 'RIGHT') moveRight();
            if (dir === 'DOWN') softDrop();
            if (dir === 'UP') rotate();
          }}
          onActionA={hardDrop}
          onActionB={rotate}
          actionALabel="SOLTAR"
          actionBLabel="GIRAR"
        />
      </div>
    </div>
  );
}
