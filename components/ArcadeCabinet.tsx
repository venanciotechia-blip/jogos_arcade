'use client';

import React from 'react';
import { GameInfo, GameId } from '@/lib/gameStore';
import { SnakeGame } from './games/SnakeGame';
import { TetrisGame } from './games/TetrisGame';
import { SpaceInvadersGame } from './games/SpaceInvadersGame';
import { BreakoutGame } from './games/BreakoutGame';
import { MinesweeperGame } from './games/MinesweeperGame';
import { PongGame } from './games/PongGame';
import { DonkeyKongGame } from './games/DonkeyKongGame';
import { SoletrandoGame } from './games/SoletrandoGame';
import { PinballGame } from './games/PinballGame';
import { SinucaGame } from './games/SinucaGame';
import { PunchOutGame } from './games/PunchOutGame';
import { DetonaRalphGame } from './games/DetonaRalphGame';
import { TennisGame } from './games/TennisGame';
import { HistoricalFigureGame } from './games/HistoricalFigureGame';
import { CRTOverlay } from './CRTOverlay';
import { Sparkles, Gamepad2, Info, Keyboard, Smartphone, Zap, Flame, Trophy, Swords, Skull } from 'lucide-react';
import { useAura, DIFFICULTY_CONFIG, AuraDifficulty } from '@/lib/auraStore';

interface ArcadeCabinetProps {
  game: GameInfo;
  crtEnabled: boolean;
  onSelectGame: (id: GameId) => void;
}

export function ArcadeCabinet({ game, crtEnabled, onSelectGame }: ArcadeCabinetProps) {
  const { totalAura, difficulty, changeDifficulty, awardWin, triggerDefeat } = useAura();

  const renderGame = () => {
    switch (game.id) {
      case 'figura_historica':
        return <HistoricalFigureGame />;
      case 'tennis':
        return <TennisGame />;
      case 'detona_ralph':
        return <DetonaRalphGame />;
      case 'punch_out':
        return <PunchOutGame />;
      case 'sinuca':
        return <SinucaGame />;
      case 'pinball':
        return <PinballGame />;
      case 'soletrando':
        return <SoletrandoGame />;
      case 'donkey_kong':
        return <DonkeyKongGame />;
      case 'snake':
        return <SnakeGame />;
      case 'tetris':
        return <TetrisGame />;
      case 'invaders':
        return <SpaceInvadersGame />;
      case 'breakout':
        return <BreakoutGame />;
      case 'minesweeper':
        return <MinesweeperGame />;
      case 'pong':
        return <PongGame />;
      default:
        return <SnakeGame />;
    }
  };

  return (
    <div id="arena" className="w-full flex flex-col items-center">
      {/* Cabinet Frame Shell in Lilac */}
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#311453] via-[#38175d] to-[#250d3f] p-4 sm:p-6 rounded-3xl border border-[#7e3bbd]/70 shadow-2xl shadow-purple-950/80">
        {/* Retro Cabinet Marquee */}
        <div className="w-full mb-3 px-4 py-2.5 bg-[#1b0730]/90 rounded-xl border border-[#7e3bbd]/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00f5ff] animate-pulse shadow-sm shadow-[#00f5ff]" />
            <div>
              <span className="text-xs font-bold text-[#00f5ff] tracking-wide font-mono uppercase neon-text-glow">
                {game.title}
              </span>
              <span className="text-[#8e4ec6] text-xs mx-2">·</span>
              <span className="text-xs text-[#a5f3fc]">{game.subtitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#00f5ff]">
            <Gamepad2 className="w-4 h-4 text-[#00f5ff]" />
            <span className="hidden sm:inline font-bold">ARCADE UNIT</span>
          </div>
        </div>

        {/* Aura & Difficulty Bar in Cabinet */}
        <div className="w-full mb-4 px-3.5 py-2 rounded-xl bg-[#220c3a]/90 border border-[#7e3bbd]/60 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#a5f3fc] flex items-center gap-1 font-bold">
              <Zap className="w-3.5 h-3.5 text-[#00f5ff]" />
              Dificuldade da Partida:
            </span>
            <div className="flex items-center gap-1">
              {(['FACIL', 'MEDIO', 'DIFICIL'] as AuraDifficulty[]).map((d) => {
                const isSelected = difficulty === d;
                const cfg = DIFFICULTY_CONFIG[d];
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => changeDifficulty(d)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${
                      isSelected
                        ? d === 'DIFICIL'
                          ? 'bg-red-600 text-white shadow-sm shadow-red-600/50'
                          : 'bg-[#00f5ff] text-[#1b0730] shadow-sm shadow-[#00f5ff]/40'
                        : 'bg-[#18052b] text-[#a5f3fc] hover:text-[#00f5ff]'
                    }`}
                  >
                    {d === 'DIFICIL' && <Flame className="w-2.5 h-2.5 fill-current" />}
                    <span>{cfg.name}</span>
                    <span className="opacity-80">({cfg.multiplierText.split(' ')[0]})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Quick Defeat Trigger */}
            <button
              type="button"
              onClick={() => triggerDefeat(game.title)}
              title="Testar tela de derrota 'ala o betinha kkkk'"
              className="px-2 py-1 rounded-lg bg-red-950/80 hover:bg-red-900/90 text-rose-300 hover:text-white border border-red-500/50 text-[11px] font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all"
            >
              <Skull className="w-3 h-3 text-red-400" />
              <span>Simular Derrota</span>
            </button>

            {/* Quick Victory Trigger */}
            <button
              type="button"
              onClick={() => awardWin(game.title, difficulty)}
              title="Registrar vitória neste jogo e farmar aura"
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#7e22ce] to-[#9333ea] hover:from-[#9333ea] hover:to-[#a855f7] text-[#00f5ff] border border-[#00f5ff]/40 text-[11px] font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all"
            >
              <Trophy className="w-3 h-3 text-yellow-300" />
              <span>Farmar Vitória (+Aura)</span>
            </button>
          </div>
        </div>

        {/* Screen Bezel with CRT Overlay */}
        <div className="relative w-full rounded-2xl overflow-hidden bg-[#18052b] border-2 border-[#7e3bbd]/80 shadow-[inset_0_0_35px_rgba(0,0,0,0.95)]">
          <CRTOverlay enabled={crtEnabled} />
          <div className="relative z-10 w-full flex justify-center">
            {renderGame()}
          </div>
        </div>

        {/* Instruction & Controls Accordion Info */}
        <div className="mt-6 pt-5 border-t border-[#7e3bbd]/50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 bg-[#200938]/80 rounded-xl border border-[#6e35a7]/60">
            <div className="flex items-center gap-2 text-[#00f5ff] font-bold mb-2">
              <Keyboard className="w-3.5 h-3.5 text-[#00f5ff]" />
              <span>Controles do Teclado</span>
            </div>
            <ul className="space-y-1 text-[#a5f3fc] font-mono text-[11px]">
              {Array.isArray(game.instructions.keyboard) ? (
                game.instructions.keyboard.map((instr, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-[#00f5ff]">›</span>
                    <span>{instr}</span>
                  </li>
                ))
              ) : (
                <li className="text-[#a5f3fc]">{game.instructions.keyboard}</li>
              )}
            </ul>
          </div>

          <div className="p-3.5 bg-[#200938]/80 rounded-xl border border-[#6e35a7]/60">
            <div className="flex items-center gap-2 text-[#00f5ff] font-bold mb-2">
              <Smartphone className="w-3.5 h-3.5 text-[#00f5ff]" />
              <span>Objetivo & Touch</span>
            </div>
            <p className="text-[#a5f3fc] text-[11px] leading-relaxed mb-2">
              {game.instructions.goal}
            </p>
            <p className="text-[#67e8f9]/80 text-[11px]">
              {game.instructions.mobile}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
