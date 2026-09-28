'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Play, Trophy, Sparkles } from 'lucide-react';
import { GameInfo, getHighScore } from '@/lib/gameStore';

interface GameCardProps {
  game: GameInfo;
  isSelected: boolean;
  onSelect: (game: GameInfo) => void;
}

export function GameCard({ game, isSelected, onSelect }: GameCardProps) {
  const [highScore] = useState<number>(() => getHighScore(game.id));

  return (
    <div
      onClick={() => onSelect(game)}
      className={`group relative flex flex-col justify-between rounded-2xl overflow-hidden border transition-all duration-300 cursor-pointer ${
        isSelected
          ? 'border-[#00f5ff] shadow-xl shadow-[#00f5ff]/20 ring-2 ring-[#00f5ff]/40 bg-[#38165c]'
          : 'border-[#6e35a7]/70 bg-[#2f134e]/90 hover:border-[#00f5ff]/70 hover:bg-[#38165c] hover:shadow-lg hover:shadow-purple-900/30'
      }`}
    >
      {/* Capa do Jogo (Cover Art Banner) */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#1a082c] border-b border-[#6e35a7]/60">
        <Image
          src={game.coverImage}
          alt={`Capa do jogo ${game.title}`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          referrerPolicy="no-referrer"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Soft atmospheric gradient over cover */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#271042] via-[#271042]/20 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#1f0b38]/85 text-[#00f5ff] border border-[#00f5ff]/40 shadow-sm backdrop-blur-sm">
            {game.genre}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#1f0b38]/85 text-[#d8b4fe] border border-[#8e4ec6]/50 shadow-sm backdrop-blur-sm">
            {game.year}
          </span>
        </div>

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[#200a38]/60 backdrop-blur-[2px]">
          <div className="px-4 py-2 rounded-xl bg-[#00f5ff] text-[#1c0833] font-bold text-xs flex items-center gap-2 shadow-lg shadow-[#00f5ff]/40 transform scale-95 group-hover:scale-100 transition-transform">
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>JOGAR CAPA</span>
          </div>
        </div>

        {/* Active Pill when Selected */}
        {isSelected && (
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#00f5ff] text-[#1c0833] text-[10px] font-extrabold uppercase tracking-wide shadow-md">
            <Sparkles className="w-3 h-3 fill-current" />
            <span>Na Cabine Ativa</span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Title in Neon Blue */}
          <h3 className="text-base font-bold text-[#00f5ff] group-hover:text-[#38e1ff] transition-colors leading-snug mb-1">
            {game.title}
          </h3>

          {/* Subtitle */}
          <p className="text-xs text-[#67e8f9] font-medium line-clamp-1 mb-2">
            {game.subtitle}
          </p>

          {/* Description */}
          <p className="text-xs text-[#a5f3fc]/80 line-clamp-2 leading-relaxed mb-3">
            {game.description}
          </p>
        </div>

        <div className="pt-3 border-t border-[#6e35a7]/50 flex items-center justify-between mt-auto">
          {/* High score */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <Trophy className="w-3.5 h-3.5 text-[#00f5ff]" />
            <span className="text-[#a5f3fc]/70 text-[11px]">Recorde:</span>
            <span className="font-bold text-[#00f5ff] tabular-nums">
              {highScore > 0 ? highScore : '—'}
            </span>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(game);
            }}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all ${
              isSelected
                ? 'bg-[#00f5ff] text-[#1c0833] shadow-md shadow-[#00f5ff]/30'
                : 'bg-[#401a6b] text-[#00f5ff] border border-[#00f5ff]/40 hover:bg-[#00f5ff] hover:text-[#1c0833]'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isSelected ? 'Em Jogo' : 'Jogar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
