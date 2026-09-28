'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Flag, Bomb, RotateCcw, Clock, Sparkles } from 'lucide-react';
import { sound } from '@/lib/sound';
import { getHighScore, saveHighScore } from '@/lib/gameStore';

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

interface Cell {
  r: number;
  c: number;
  isMine: boolean;
  revealed: boolean;
  flagged: boolean;
  neighborMines: number;
}

const DIFFICULTY_SETTINGS: Record<Difficulty, { rows: number; cols: number; mines: number; name: string }> = {
  EASY: { rows: 9, cols: 9, mines: 10, name: 'Fácil' },
  MEDIUM: { rows: 14, cols: 14, mines: 30, name: 'Médio' },
  HARD: { rows: 16, cols: 18, mines: 52, name: 'Difícil' },
};

const NUMBER_COLORS: Record<number, string> = {
  1: 'text-blue-400 font-bold',
  2: 'text-emerald-400 font-bold',
  3: 'text-red-400 font-bold',
  4: 'text-purple-400 font-bold',
  5: 'text-amber-400 font-bold',
  6: 'text-cyan-400 font-bold',
  7: 'text-pink-400 font-bold',
  8: 'text-slate-200 font-bold',
};

function createEmptyBoard(rows: number, cols: number): Cell[][] {
  const board: Cell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < cols; c++) {
      row.push({
        r,
        c,
        isMine: false,
        revealed: false,
        flagged: false,
        neighborMines: 0,
      });
    }
    board.push(row);
  }
  return board;
}

function placeMinesAndCalculate(
  rows: number,
  cols: number,
  mines: number,
  safeR: number,
  safeC: number,
  board: Cell[][]
) {
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    // Don't place on first click or immediate neighbors
    if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
    if (!board[r][c].isMine) {
      board[r][c].isMine = true;
      placed++;
    }
  }

  // Calculate neighbors
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].isMine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].isMine) {
            count++;
          }
        }
      }
      board[r][c].neighborMines = count;
    }
  }
}

export function MinesweeperGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
  const [grid, setGrid] = useState<Cell[][]>(() => createEmptyBoard(9, 9));
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'WON' | 'LOST'>('IDLE');
  const [faceState, setFaceState] = useState<'SMILE' | 'SCARED' | 'DEAD' | 'COOL'>('SMILE');
  const [flagsLeft, setFlagsLeft] = useState(10);
  const [timer, setTimer] = useState(0);
  const [mobileFlagMode, setMobileFlagMode] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const firstClickRef = useRef<boolean>(true);

  const { rows, cols, mines } = DIFFICULTY_SETTINGS[difficulty];

  const startNewGame = useCallback((diff: Difficulty) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const cfg = DIFFICULTY_SETTINGS[diff];
    setGrid(createEmptyBoard(cfg.rows, cfg.cols));
    setGameState('IDLE');
    setFaceState('SMILE');
    setFlagsLeft(cfg.mines);
    setTimer(0);
    firstClickRef.current = true;
  }, []);

  const handleDifficultyChange = (newDiff: Difficulty) => {
    setDifficulty(newDiff);
    startNewGame(newDiff);
  };

  // Timer loop
  useEffect(() => {
    if (gameState === 'PLAYING') {
      timerRef.current = setInterval(() => {
        setTimer((t) => Math.min(999, t + 1));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  const revealCell = (r: number, c: number) => {
    if (gameState === 'LOST' || gameState === 'WON') return;
    const current = grid[r][c];
    if (current.revealed || current.flagged) return;

    sound.playMove();

    const newGrid = grid.map((row) => row.map((cell) => ({ ...cell })));

    // First click setup
    if (firstClickRef.current) {
      firstClickRef.current = false;
      placeMinesAndCalculate(rows, cols, mines, r, c, newGrid);
      setGameState('PLAYING');
    }

    // Clicked a mine -> Game Over
    if (newGrid[r][c].isMine) {
      sound.playExplosion();
      setGameState('LOST');
      setFaceState('DEAD');

      // Reveal all mines
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          if (newGrid[i][j].isMine) {
            newGrid[i][j].revealed = true;
          }
        }
      }
      setGrid(newGrid);
      return;
    }

    // Flood fill reveal for empty 0 cells
    const queue: [number, number][] = [[r, c]];
    newGrid[r][c].revealed = true;

    while (queue.length > 0) {
      const [currR, currC] = queue.shift()!;
      if (newGrid[currR][currC].neighborMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = currR + dr;
            const nc = currC + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              const neighbor = newGrid[nr][nc];
              if (!neighbor.revealed && !neighbor.flagged && !neighbor.isMine) {
                neighbor.revealed = true;
                if (neighbor.neighborMines === 0) {
                  queue.push([nr, nc]);
                }
              }
            }
          }
        }
      }
    }

    // Check Victory
    let unrevealedSafe = 0;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        if (!newGrid[i][j].isMine && !newGrid[i][j].revealed) {
          unrevealedSafe++;
        }
      }
    }

    if (unrevealedSafe === 0) {
      sound.playClear();
      setGameState('WON');
      setFaceState('COOL');
      const scoreCalc = Math.max(10, 1000 - timer * 2);
      saveHighScore('minesweeper', scoreCalc);
    }

    setGrid(newGrid);
  };

  const toggleFlag = (e: React.MouseEvent | null, r: number, c: number) => {
    if (e) e.preventDefault();
    if (gameState === 'LOST' || gameState === 'WON') return;
    const cell = grid[r][c];
    if (cell.revealed) return;

    sound.playClick();
    const newGrid = grid.map((row) => row.map((cl) => ({ ...cl })));
    const willFlag = !cell.flagged;

    if (willFlag && flagsLeft <= 0) return;

    newGrid[r][c].flagged = willFlag;
    setFlagsLeft((f) => (willFlag ? f - 1 : f + 1));
    setGrid(newGrid);
  };

  const handleCellClick = (r: number, c: number) => {
    if (mobileFlagMode) {
      toggleFlag(null, r, c);
    } else {
      revealCell(r, c);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto">
      {/* Top HUD */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/90 border border-slate-800 rounded-t-xl text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-950/40 border border-red-800/40 rounded text-red-400 font-bold">
            <Bomb className="w-3.5 h-3.5" />
            <span className="tabular-nums">{String(flagsLeft).padStart(3, '0')}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-amber-400 font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span className="tabular-nums">{String(timer).padStart(3, '0')}</span>
          </div>
        </div>

        {/* Retro Smiley Reset Button */}
        <button
          onClick={() => startNewGame(difficulty)}
          onMouseDown={() => setFaceState('SCARED')}
          onMouseUp={() => setFaceState(gameState === 'LOST' ? 'DEAD' : gameState === 'WON' ? 'COOL' : 'SMILE')}
          className="w-10 h-10 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 border-2 border-amber-300 shadow-md flex items-center justify-center text-xl transition-transform"
          aria-label="Reiniciar Campo Minado"
        >
          {faceState === 'SMILE' && '🙂'}
          {faceState === 'SCARED' && '😮'}
          {faceState === 'DEAD' && '😵'}
          {faceState === 'COOL' && '😎'}
        </button>

        {/* Difficulty Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
          {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => handleDifficultyChange(d)}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                difficulty === d ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              {DIFFICULTY_SETTINGS[d].name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid Viewport */}
      <div className="w-full p-4 bg-slate-950 border-x border-slate-800 flex flex-col items-center justify-center overflow-x-auto min-h-[380px]">
        <div
          className="inline-grid gap-1 bg-slate-900/80 p-2 rounded-lg border-2 border-slate-800 shadow-inner select-none"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          }}
        >
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => handleCellClick(r, c)}
                onContextMenu={(e) => toggleFlag(e, r, c)}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded flex items-center justify-center font-mono text-sm transition-all ${
                  cell.revealed
                    ? cell.isMine
                      ? 'bg-red-600 text-white shadow-inner animate-pulse'
                      : 'bg-slate-950/80 border border-slate-850'
                    : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-850 border-t border-l border-slate-700 border-b border-r border-slate-900 shadow-sm'
                }`}
              >
                {cell.revealed ? (
                  cell.isMine ? (
                    <Bomb className="w-4 h-4" />
                  ) : cell.neighborMines > 0 ? (
                    <span className={NUMBER_COLORS[cell.neighborMines] || 'text-slate-200'}>
                      {cell.neighborMines}
                    </span>
                  ) : null
                ) : cell.flagged ? (
                  <Flag className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Bottom Bar: Instructions & Mobile Flag Toggle */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-b-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          {/* Mobile Flag Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setMobileFlagMode((m) => !m);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-all ${
              mobileFlagMode
                ? 'bg-red-500/20 text-red-300 border-red-500/50 shadow-sm'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <Flag className={`w-3.5 h-3.5 ${mobileFlagMode ? 'text-red-400 fill-red-400' : ''}`} />
            <span>Toque: {mobileFlagMode ? 'Marcar Bandeira' : 'Abrir Quadrante'}</span>
          </button>

          <div className="text-[11px] text-slate-400 font-mono hidden sm:inline">
            Clique esquerdo: Abrir · Botão direito: Bandeira
          </div>

          <button
            onClick={() => startNewGame(difficulty)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Novo Tabuleiro
          </button>
        </div>

        {gameState === 'WON' && (
          <div className="mt-1 p-2 bg-emerald-950/40 border border-emerald-800/40 rounded-lg text-center text-xs text-emerald-300 font-medium animate-fade-in flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Vitória! Você limpou todo o campo em {timer} segundos!</span>
          </div>
        )}

        {gameState === 'LOST' && (
          <div className="mt-1 p-2 bg-red-950/40 border border-red-800/40 rounded-lg text-center text-xs text-red-300 font-medium flex items-center justify-center gap-2">
            <Bomb className="w-4 h-4 text-red-400" />
            <span>Bomba detonada! Clique na carinha amarela para tentar novamente.</span>
          </div>
        )}
      </div>
    </div>
  );
}
