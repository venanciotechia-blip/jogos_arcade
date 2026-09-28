'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Volume2, VolumeX, Tv } from 'lucide-react';
import { sound } from '@/lib/sound';

interface NavbarProps {
  crtEnabled: boolean;
  onToggleCrt: () => void;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
}

export function Navbar({ crtEnabled, onToggleCrt }: NavbarProps) {
  const [isMuted, setIsMuted] = useState(() => sound.getMuted());

  const handleToggleMute = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#220c3a]/90 backdrop-blur-md border-b border-[#6e35a7]/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark in Neon Blue */}
        <Link
          href="/"
          className="text-lg font-extrabold tracking-tight text-[#00f5ff] neon-text-glow hover:text-[#38e1ff] transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#00f5ff] animate-pulse shadow-sm shadow-[#00f5ff]" />
          Arcade Clássicos
        </Link>

        {/* Zone 2: 4-6 clean text navigation links in Neon Blue */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#67e8f9]">
          <a href="#jogos" className="hover:text-[#00f5ff] hover:drop-shadow-[0_0_8px_rgba(0,245,255,0.7)] transition-all">
            Catálogo
          </a>
          <a href="#arena" className="hover:text-[#00f5ff] hover:drop-shadow-[0_0_8px_rgba(0,245,255,0.7)] transition-all">
            Cabine
          </a>
          <a href="#regras" className="hover:text-[#00f5ff] hover:drop-shadow-[0_0_8px_rgba(0,245,255,0.7)] transition-all">
            História
          </a>
        </nav>

        {/* Zone 3: 1-2 primary functional actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleCrt}
            title={crtEnabled ? 'Desativar efeito CRT' : 'Ativar efeito CRT retrô'}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap border ${
              crtEnabled
                ? 'bg-[#00f5ff]/20 text-[#00f5ff] border-[#00f5ff]/60 shadow-sm shadow-[#00f5ff]/30'
                : 'bg-[#331553] text-[#67e8f9] border-[#6e35a7]/70 hover:text-[#00f5ff] hover:border-[#00f5ff]/40'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{crtEnabled ? 'CRT: Ligado' : 'CRT: Desligado'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            title={isMuted ? 'Ativar sons retrô' : 'Silenciar áudio'}
            className={`p-2 text-xs font-medium rounded-lg transition-colors border ${
              isMuted
                ? 'bg-red-950/40 text-red-400 border-red-800/40'
                : 'bg-[#331553] text-[#00f5ff] border-[#6e35a7]/70 hover:text-[#38e1ff] hover:border-[#00f5ff]/40'
            }`}
            aria-label={isMuted ? 'Ativar som' : 'Silenciar áudio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
