'use client';

import React, { useState } from 'react';
import { Zap, Trophy, Flame, ChevronRight, Award, Sparkles, Swords, Skull } from 'lucide-react';
import { useAura, DIFFICULTY_CONFIG, AuraDifficulty, AURA_RANKS } from '@/lib/auraStore';

export function AuraBar() {
  const { totalAura, difficulty, changeDifficulty, levelInfo, lastGain, awardWin, triggerDefeat } = useAura();
  const [showRanksModal, setShowRanksModal] = useState(false);

  return (
    <div className="w-full bg-[#1e0a33]/95 border-b border-[#7e3bbd]/70 backdrop-blur-md sticky top-16 z-30 shadow-xl shadow-purple-950/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Level Rank & Name */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <button
            type="button"
            onClick={() => setShowRanksModal((v) => !v)}
            title="Ver todos os rankings de Aura"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#2a1047] border border-[#7e3bbd] hover:border-[#00f5ff] transition-all group"
          >
            <span className="text-xl" role="img" aria-label="badge">
              {levelInfo.badge}
            </span>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-[#00f5ff] uppercase font-bold tracking-wider">
                  NÍVEL {levelInfo.level}
                </span>
                <span className="text-[10px] text-[#a5f3fc]/60 hidden sm:inline">· {levelInfo.title}</span>
              </div>
              <div className="text-xs font-black font-mono text-white group-hover:text-[#00f5ff] transition-colors flex items-center gap-1">
                <span>{totalAura.toLocaleString()}</span>
                <span className="text-[#00f5ff]">⚡ AURA</span>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#00f5ff] group-hover:translate-x-0.5 transition-transform ml-1" />
          </button>

          {/* Quick difficulty label on mobile */}
          <div className="flex md:hidden items-center gap-1 text-[11px] font-mono">
            <span className="text-[#a5f3fc]/80">Modo:</span>
            <span className="font-bold text-[#00f5ff]">{DIFFICULTY_CONFIG[difficulty].name}</span>
          </div>
        </div>

        {/* Center: The Core "AURA FARMADA" XP Progress Bar */}
        <div className="w-full md:flex-1 md:max-w-md flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#00f5ff] animate-pulse" />
              <span className="font-extrabold text-[#00f5ff] tracking-wide uppercase neon-text-glow">
                Aura Farmada
              </span>
            </div>
            <div className="text-[#a5f3fc] font-bold tabular-nums">
              <span>{levelInfo.currentLevelAura}</span>
              <span className="text-[#7e3bbd] mx-0.5">/</span>
              <span>{levelInfo.levelSpan} XP</span>
              <span className="text-[#00f5ff] ml-1.5">({levelInfo.progressPercent}%)</span>
            </div>
          </div>

          {/* Glowing XP Progress Track */}
          <div className="relative w-full h-3 rounded-full bg-[#140624] border border-[#7e3bbd]/60 overflow-hidden shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00f5ff] via-[#818cf8] to-[#d946ef] transition-all duration-500 relative"
              style={{ width: `${levelInfo.progressPercent}%` }}
            >
              {/* Shimmer light sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
            </div>
          </div>
        </div>

        {/* Right: Difficulty Selector & Victory Test CTA */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#2a1047] border border-[#7e3bbd]/70 text-xs font-mono">
            {(['FACIL', 'MEDIO', 'DIFICIL'] as AuraDifficulty[]).map((diffKey) => {
              const cfg = DIFFICULTY_CONFIG[diffKey];
              const isSelected = difficulty === diffKey;
              return (
                <button
                  key={diffKey}
                  type="button"
                  onClick={() => changeDifficulty(diffKey)}
                  title={`${cfg.description} · ${cfg.multiplierText}`}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all text-[11px] whitespace-nowrap flex items-center gap-1 ${
                    isSelected
                      ? diffKey === 'DIFICIL'
                        ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                        : 'bg-[#00f5ff] text-[#1a072f] shadow-md shadow-[#00f5ff]/30'
                      : 'text-[#a5f3fc] hover:text-[#00f5ff] hover:bg-[#39175f]'
                  }`}
                >
                  {diffKey === 'DIFICIL' && <Flame className="w-3 h-3 fill-current text-yellow-300" />}
                  <span>{cfg.name}</span>
                  <span className="text-[10px] opacity-80 hidden lg:inline">({cfg.points})</span>
                </button>
              );
            })}
          </div>

          {/* Quick Defeat Test button */}
          <button
            type="button"
            onClick={() => triggerDefeat('Arcade Master')}
            title="Simular derrota para ver a animação 'ala o betinha kkkk'"
            className="px-2 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900/90 text-rose-300 hover:text-white border border-red-500/50 text-xs font-mono font-bold flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-all shadow-md shadow-red-950/40"
          >
            <Skull className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden sm:inline">Testar Derrota</span>
          </button>

          {/* Quick Win / Farm Test button so user can test anytime */}
          <button
            type="button"
            onClick={() => awardWin('Arcade Master', difficulty)}
            title="Simular vitória para farmar aura no nível selecionado"
            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#7e22ce] to-[#9333ea] hover:from-[#9333ea] hover:to-[#a855f7] text-[#00f5ff] border border-[#00f5ff]/40 text-xs font-mono font-bold flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-all shadow-md shadow-purple-900/30"
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Farmar Vitória</span>
          </button>
        </div>
      </div>

      {/* Ranks Directory Modal */}
      {showRanksModal && (
        <div
          onClick={() => setShowRanksModal(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#250d3f] border-2 border-[#7e3bbd] rounded-2xl p-5 shadow-2xl text-[#00f5ff]"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#7e3bbd]/60 mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h3 className="font-extrabold text-base uppercase font-mono text-white">
                  Rankings de Aura Farmada
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRanksModal(false)}
                className="text-[#a5f3fc] hover:text-white text-sm font-mono px-2 py-1 rounded bg-[#3b1761]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {AURA_RANKS.map((r) => {
                const isCurrent = levelInfo.level === r.level;
                return (
                  <div
                    key={r.level}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono transition-all ${
                      isCurrent
                        ? 'bg-[#3b1761] border-[#00f5ff] shadow-md shadow-[#00f5ff]/20'
                        : 'bg-[#1e0833] border-[#7e3bbd]/40 text-[#a5f3fc]/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{r.badge}</span>
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>Nível {r.level}: {r.title}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded bg-[#00f5ff] text-[#1b0730] text-[9px] font-extrabold uppercase">
                              Seu Nível
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#a5f3fc]/60 mt-0.5">
                          {r.minAura} a {r.maxAura >= 100000 ? '∞' : r.maxAura} XP
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-[#7e3bbd]/60 text-center text-xs text-[#a5f3fc]">
              Vença partidas no modo <strong className="text-red-400">DIFÍCIL</strong> para faturar +600 Aura e destravar o efeito <strong>&quot;FARMOU DEMAIS SLK&quot;</strong>!
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
