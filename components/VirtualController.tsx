'use client';

import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Play, RotateCw, ShieldAlert } from 'lucide-react';
import { sound } from '@/lib/sound';

interface VirtualControllerProps {
  onDirection: (dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => void;
  onActionA?: () => void;
  onActionB?: () => void;
  actionALabel?: string;
  actionBLabel?: string;
  className?: string;
}

export function VirtualController({
  onDirection,
  onActionA,
  onActionB,
  actionALabel = 'AÇÃO',
  actionBLabel = 'RODAR',
  className = '',
}: VirtualControllerProps) {
  const handlePress = (callback?: () => void) => {
    if (!callback) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {}
    }
    sound.playClick();
    callback();
  };

  return (
    <div className={`flex items-center justify-between gap-4 p-3 bg-slate-900/80 border border-slate-800 rounded-xl backdrop-blur-md select-none touch-manipulation ${className}`}>
      {/* D-Pad */}
      <div className="grid grid-cols-3 gap-1.5 w-32 h-32 p-1 bg-slate-950/60 rounded-xl border border-slate-850">
        <div />
        <button
          type="button"
          onClick={() => handlePress(() => onDirection('UP'))}
          className="flex items-center justify-center bg-slate-800 active:bg-amber-500 active:text-slate-950 text-slate-200 rounded-lg shadow-inner hover:bg-slate-700 transition-colors"
          aria-label="Cima"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
        <div />

        <button
          type="button"
          onClick={() => handlePress(() => onDirection('LEFT'))}
          className="flex items-center justify-center bg-slate-800 active:bg-amber-500 active:text-slate-950 text-slate-200 rounded-lg shadow-inner hover:bg-slate-700 transition-colors"
          aria-label="Esquerda"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center justify-center text-[10px] font-mono text-slate-600 font-bold">
          D-PAD
        </div>
        <button
          type="button"
          onClick={() => handlePress(() => onDirection('RIGHT'))}
          className="flex items-center justify-center bg-slate-800 active:bg-amber-500 active:text-slate-950 text-slate-200 rounded-lg shadow-inner hover:bg-slate-700 transition-colors"
          aria-label="Direita"
        >
          <ArrowRight className="w-5 h-5" />
        </button>

        <div />
        <button
          type="button"
          onClick={() => handlePress(() => onDirection('DOWN'))}
          className="flex items-center justify-center bg-slate-800 active:bg-amber-500 active:text-slate-950 text-slate-200 rounded-lg shadow-inner hover:bg-slate-700 transition-colors"
          aria-label="Baixo"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
        <div />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {onActionB && (
          <button
            type="button"
            onClick={() => handlePress(onActionB)}
            className="w-14 h-14 rounded-full bg-cyan-600 active:bg-cyan-400 text-white font-bold text-xs flex flex-col items-center justify-center shadow-lg active:scale-95 transition-all border border-cyan-400/40"
          >
            <RotateCw className="w-4 h-4 mb-0.5" />
            <span className="text-[9px] tracking-wider uppercase">{actionBLabel}</span>
          </button>
        )}

        {onActionA && (
          <button
            type="button"
            onClick={() => handlePress(onActionA)}
            className="w-16 h-16 rounded-full bg-amber-500 active:bg-amber-300 text-slate-950 font-bold text-xs flex flex-col items-center justify-center shadow-lg active:scale-95 transition-all border border-amber-300/60"
          >
            <Play className="w-5 h-5 fill-current mb-0.5" />
            <span className="text-[9px] tracking-wider uppercase">{actionALabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
