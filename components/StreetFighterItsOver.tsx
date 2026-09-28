'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Zap, Flame, Trophy, Skull, HeartCrack } from 'lucide-react';
import { AuraWinEventDetail, DefeatEventDetail } from '@/lib/auraStore';

type OverlayMode = 'VICTORY' | 'DEFEAT';

interface OverlayState {
  mode: OverlayMode;
  message: string;
  gameName: string;
  gainedAura?: number;
}

export function StreetFighterItsOver() {
  const [active, setActive] = useState(false);
  const [data, setData] = useState<OverlayState | null>(null);

  useEffect(() => {
    const handleVictoryItsOver = (e: Event) => {
      const customEvent = e as CustomEvent<AuraWinEventDetail>;
      if (customEvent.detail) {
        setData({
          mode: 'VICTORY',
          message: 'farmou demais slk',
          gameName: customEvent.detail.gameName,
          gainedAura: customEvent.detail.gained,
        });
        setActive(true);
      }
    };

    const handleDefeatItsOver = (e: Event) => {
      const customEvent = e as CustomEvent<DefeatEventDetail>;
      const detail = customEvent.detail;
      setData({
        mode: 'DEFEAT',
        message: detail?.message || 'ala o betinha kkkk',
        gameName: detail?.gameName || 'Arcade',
      });
      setActive(true);
    };

    window.addEventListener('aura_street_fighter_its_over', handleVictoryItsOver);
    window.addEventListener('arcade_defeat_its_over', handleDefeatItsOver);
    return () => {
      window.removeEventListener('aura_street_fighter_its_over', handleVictoryItsOver);
      window.removeEventListener('arcade_defeat_its_over', handleDefeatItsOver);
    };
  }, []);

  // Auto-dismiss after 4.5 seconds
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      setActive(false);
    }, 4500);
    return () => clearTimeout(timer);
  }, [active]);

  if (!active || !data) return null;

  const isVictory = data.mode === 'VICTORY';

  return (
    <div
      onClick={() => setActive(false)}
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer select-none overflow-hidden bg-black/90 backdrop-blur-md animate-sf-shake"
    >
      {/* Street Fighter Diagonal Ink / Battle Slash Banner in Background */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div
          className={`w-[140%] h-44 sm:h-56 bg-gradient-to-r from-transparent ${
            isVictory ? 'via-[#881337]' : 'via-[#4c0519]'
          } to-transparent transform -rotate-6 sm:-rotate-12 opacity-80 blur-sm`}
        />
        <div
          className={`absolute w-[130%] h-24 sm:h-36 bg-gradient-to-r from-transparent ${
            isVictory ? 'via-[#dc2626]' : 'via-[#991b1b]'
          } to-transparent transform -rotate-6 sm:-rotate-12 opacity-90`}
        />
        <div
          className={`absolute w-[120%] h-12 sm:h-16 bg-gradient-to-r from-transparent ${
            isVictory ? 'via-[#f59e0b]' : 'via-[#ea580c]'
          } to-transparent transform -rotate-6 sm:-rotate-12 opacity-85`}
        />
      </div>

      {/* Dramatic Street Fighter Speed Lines Background */}
      <div className="absolute inset-0 pointer-events-none opacity-50">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="sf-radial" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={isVictory ? '#00f5ff' : '#f43f5e'} stopOpacity="0.4" />
              <stop offset="35%" stopColor="#ef4444" stopOpacity="0.3" />
              <stop offset="70%" stopColor="#7e22ce" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.95" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#sf-radial)" />
          {/* Radial speed lines */}
          {Array.from({ length: 48 }).map((_, i) => {
            const angle = (i * 7.5 * Math.PI) / 180;
            const x2 = 50 + 60 * Math.cos(angle);
            const y2 = 50 + 60 * Math.sin(angle);
            return (
              <line
                key={i}
                x1="50%"
                y1="50%"
                x2={`${x2}%`}
                y2={`${y2}%`}
                stroke={i % 3 === 0 ? (isVictory ? '#00f5ff' : '#f43f5e') : i % 2 === 0 ? '#facc15' : '#ef4444'}
                strokeWidth={i % 4 === 0 ? '3.5' : i % 2 === 0 ? '2' : '1'}
                strokeOpacity={i % 2 === 0 ? '0.6' : '0.25'}
              />
            );
          })}
        </svg>
      </div>

      {/* Screen flash on hit */}
      <div className="absolute inset-0 bg-white/40 pointer-events-none animate-ping duration-300 opacity-60" />

      {/* Street Fighter Impact Banner Container */}
      <div className="relative z-10 max-w-4xl w-full mx-4 flex flex-col items-center text-center">
        {/* Top Street Fighter Arcade Marquee Badge */}
        <div className="flex items-center gap-2 sm:gap-3 mb-3 animate-bounce">
          {isVictory ? (
            <>
              <span className="px-4 sm:px-6 py-1 rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-red-700 text-white font-mono font-black text-xs sm:text-base tracking-widest uppercase border-2 border-yellow-300 shadow-[0_0_25px_rgba(239,68,68,0.9)] transform -skew-x-12 flex items-center gap-1.5">
                <Flame className="w-4 h-4 fill-yellow-300 text-yellow-300 animate-pulse" />
                <span>IT&apos;S OVER!</span>
                <Flame className="w-4 h-4 fill-yellow-300 text-yellow-300 animate-pulse" />
              </span>
              <span className="px-3 sm:px-4 py-1 rounded-full bg-[#00f5ff]/25 text-[#00f5ff] font-mono font-black text-xs sm:text-sm tracking-wider uppercase border border-[#00f5ff] shadow-[0_0_15px_rgba(0,245,255,0.6)] transform -skew-x-12">
                MODO DIFÍCIL VENCIDO
              </span>
            </>
          ) : (
            <>
              <span className="px-4 sm:px-6 py-1 rounded-full bg-gradient-to-r from-neutral-900 via-red-900 to-black text-white font-mono font-black text-xs sm:text-base tracking-widest uppercase border-2 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.8)] transform -skew-x-12 flex items-center gap-1.5">
                <Skull className="w-4 h-4 text-red-400 animate-pulse" />
                <span>YOU LOSE!</span>
                <Skull className="w-4 h-4 text-red-400 animate-pulse" />
              </span>
              <span className="px-3 sm:px-4 py-1 rounded-full bg-red-600/30 text-red-300 font-mono font-black text-xs sm:text-sm tracking-wider uppercase border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] transform -skew-x-12">
                FOI DE BASE
              </span>
            </>
          )}
        </div>

        {/* The Legendary Slam Title: "farmou demais slk" OR "ala o betinha kkkk" */}
        <div className="relative my-3 transform animate-sf-slam">
          {/* Flame & Electric Aura Backdrop */}
          <div
            className={`absolute -inset-8 bg-gradient-to-r ${
              isVictory
                ? 'from-amber-500/0 via-red-600/30 to-[#00f5ff]/30'
                : 'from-red-600/0 via-rose-700/40 to-purple-600/30'
            } blur-2xl pointer-events-none animate-pulse`}
          />

          {/* Background Shadow Layer */}
          <h1
            aria-hidden="true"
            className="absolute inset-0 text-5xl sm:text-7xl md:text-9xl font-black italic tracking-tighter uppercase leading-none select-none text-black transform translate-y-3 sm:translate-y-4"
            style={{
              WebkitTextStroke: '6px #000000',
              fontFamily: 'impact, system-ui, sans-serif',
            }}
          >
            {data.message}
          </h1>

          {/* Main Street Fighter Fiery Letters */}
          <h1
            className="relative text-5xl sm:text-7xl md:text-9xl font-black italic tracking-tighter uppercase leading-none select-none text-transparent bg-clip-text bg-gradient-to-b from-[#ffffff] via-[#fde047] via-[#f97316] to-[#dc2626] sf-flame-text"
            style={{
              WebkitTextStroke: '3.5px #050505',
              fontFamily: 'impact, system-ui, sans-serif',
              letterSpacing: '-0.04em',
            }}
          >
            {data.message}
          </h1>
        </div>

        {/* Sub-ribbon with Neon Border */}
        <div
          className={`mt-4 sm:mt-6 p-4 sm:p-5 rounded-2xl bg-[#1e0833]/95 border-2 ${
            isVictory ? 'border-[#00f5ff] shadow-[0_0_35px_rgba(0,245,255,0.5)]' : 'border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.5)]'
          } flex flex-col sm:flex-row items-center gap-4 px-6 sm:px-8 transform hover:scale-102 transition-transform`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center font-black shadow-lg ${
                isVictory
                  ? 'bg-gradient-to-br from-yellow-300 via-amber-500 to-red-600 text-slate-950 shadow-yellow-500/40'
                  : 'bg-gradient-to-br from-rose-600 via-red-700 to-neutral-900 text-white shadow-red-500/40'
              }`}
            >
              {isVictory ? (
                <Zap className="w-7 h-7 fill-current animate-pulse" />
              ) : (
                <HeartCrack className="w-7 h-7 text-rose-200 animate-pulse" />
              )}
            </div>
            <div className="text-left">
              <div className="text-[11px] font-mono text-[#a5f3fc] uppercase font-bold tracking-wider flex items-center gap-1.5">
                <span>{isVictory ? 'Vitória no Nível Hardcore' : 'Derrota no Arcade'}</span>
                <span className={isVictory ? 'text-yellow-400' : 'text-red-400'}>
                  {isVictory ? '★★★★★' : '💀💀💀'}
                </span>
              </div>
              <div
                className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                  isVictory ? 'text-[#00f5ff] neon-text-glow' : 'text-rose-400'
                }`}
              >
                {isVictory ? `+${data.gainedAura || 600} AURA FARMADA!` : '0 AURA FARMADA!'}
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-[#7e22ce] hidden sm:block" />

          <div
            className={`flex items-center gap-2 text-xs font-mono px-3.5 py-2 rounded-xl border ${
              isVictory
                ? 'text-[#fef08a] bg-yellow-950/70 border-yellow-500/40'
                : 'text-rose-200 bg-red-950/70 border-red-500/40'
            }`}
          >
            {isVictory ? <Trophy className="w-4 h-4 text-yellow-400" /> : <Skull className="w-4 h-4 text-red-400" />}
            <span>
              Jogo: <strong>{data.gameName}</strong>
            </span>
          </div>
        </div>

        {/* Action instruction */}
        <div className="mt-6 flex items-center gap-2 text-xs font-mono text-[#a5f3fc]/80 bg-[#1e0a33]/60 px-4 py-1.5 rounded-full border border-[#7e3bbd]/50">
          <span>{isVictory ? 'Clique em qualquer lugar para continuar farmando' : 'Clique em qualquer lugar para tentar de novo'}</span>
          <span className="text-[#00f5ff] font-bold">››</span>
        </div>
      </div>
    </div>
  );
}
