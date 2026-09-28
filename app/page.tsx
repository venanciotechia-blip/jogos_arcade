'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Navbar } from '@/components/Navbar';
import { ArcadeCabinet } from '@/components/ArcadeCabinet';
import { GameCard } from '@/components/GameCard';
import { GAMES_CATALOG, GameInfo, GameId } from '@/lib/gameStore';
import { Play, Sparkles, Trophy, Gamepad2, ShieldCheck, Zap } from 'lucide-react';

export default function Home() {
  const [selectedGame, setSelectedGame] = useState<GameInfo>(GAMES_CATALOG[0]);
  const [crtEnabled, setCrtEnabled] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const filteredGames = GAMES_CATALOG.filter((game) => {
    if (activeFilter === 'all') return true;
    return game.genre.toLowerCase() === activeFilter.toLowerCase();
  });

  const handleSelectGame = (game: GameInfo) => {
    setSelectedGame(game);
    // Smooth scroll to cabinet
    const arena = document.getElementById('arena');
    if (arena) {
      arena.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectGameById = (id: GameId) => {
    const found = GAMES_CATALOG.find((g) => g.id === id);
    if (found) {
      handleSelectGame(found);
    }
  };

  return (
    <div className="min-h-screen bg-[#271042] text-[#00f5ff] flex flex-col">
      <Navbar
        crtEnabled={crtEnabled}
        onToggleCrt={() => setCrtEnabled((prev) => !prev)}
      />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-[#7e3bbd]/60">
          {/* Background hero image with measured dark contrast scrim */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/assets/images/hero_banner.jpg"
              alt="Sala de jogos retrô com máquinas de arcade iluminadas por neon"
              fill
              priority
              referrerPolicy="no-referrer"
              className="object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#271042] via-[#271042]/90 to-[#271042]/70" />
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
            <div className="max-w-2xl">
              {/* Unboxed editorial kicker */}
              <div className="flex items-center gap-2 text-xs font-mono text-[#00f5ff] mb-4 tracking-wider uppercase font-bold">
                <Sparkles className="w-4 h-4 text-[#00f5ff]" />
                <span>Salão de Jogos Retrô Digital</span>
                <span aria-hidden="true">·</span>
                <span>Anos 70, 80 e 90</span>
              </div>

              {/* Headline with balanced wrapping */}
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#00f5ff] neon-text-glow mb-4 [text-wrap:balance]">
                Reviva a Era de Ouro dos Videogames Clássicos
              </h1>

              {/* Subheading */}
              <p className="text-base sm:text-lg text-[#a5f3fc] leading-relaxed mb-8">
                Lendas dos fliperamas, esportes e enigmas mentais recriadas com fidelidade nostálgica: Grand Slam Tennis (com efeito, saque e regulador de força), Quem Sou Eu? Enigma Histórico (perguntas de sim ou não), Sinuca de Bar, Pinball Galáctico, Detona Ralph, Punch-Out, Tetris, Space Invaders, Cobrinha e Pong. Jogue direto no navegador com capas temáticas exclusivas!
              </p>

              {/* CTA Row */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectGame(selectedGame)}
                  className="px-6 py-3 rounded-xl bg-[#00f5ff] hover:bg-[#38e1ff] active:scale-95 text-[#1a072f] font-extrabold text-sm shadow-lg shadow-[#00f5ff]/30 transition-all flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Jogar Agora: {selectedGame.title}</span>
                </button>

                <a
                  href="#jogos"
                  className="px-5 py-3 rounded-xl bg-[#39175f] hover:bg-[#491e7a] text-[#00f5ff] border border-[#7e3bbd] text-sm font-bold transition-colors shadow-sm"
                >
                  Explorar Catálogo ({GAMES_CATALOG.length})
                </a>
              </div>

              {/* Unboxed Metadata Stats */}
              <div className="mt-10 pt-6 border-t border-[#7e3bbd]/60 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-[#67e8f9] font-mono">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-[#00f5ff]" />
                  <span>{GAMES_CATALOG.length} Títulos com Capas Temáticas</span>
                </div>
                <span aria-hidden="true">·</span>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#00f5ff]" />
                  <span>Sem Instalação</span>
                </div>
                <span aria-hidden="true">·</span>
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#00f5ff]" />
                  <span>Recordes Locais</span>
                </div>
                <span aria-hidden="true">·</span>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#d8b4fe]" />
                  <span>100% Gratuito</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Arcade Active Play Arena */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 max-w-6xl mx-auto">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="text-xs font-mono text-[#a5f3fc] uppercase tracking-wider mb-2 font-bold">
              Cabine de Arcade Ativa
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#00f5ff] neon-text-glow mb-4">
              Escolha seu Jogo e Entre na Partida
            </h2>

            {/* Segmented Game Switcher Bar */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 p-1.5 bg-[#331454]/90 border border-[#7e3bbd]/70 rounded-xl max-w-full">
              {GAMES_CATALOG.map((g) => {
                const isActive = selectedGame.id === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGame(g)}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-[#00f5ff] text-[#1a072f] shadow-md shadow-[#00f5ff]/30'
                        : 'text-[#a5f3fc] hover:text-[#00f5ff] hover:bg-[#471e75]'
                    }`}
                  >
                    {g.title}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Arcade Cabinet */}
          <ArcadeCabinet
            game={selectedGame}
            crtEnabled={crtEnabled}
            onSelectGame={handleSelectGameById}
          />
        </section>

        {/* Games Catalog Section with Capas */}
        <section id="jogos" className="py-14 border-t border-[#7e3bbd]/60 bg-[#210c38]/80 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <div className="text-xs font-mono text-[#00f5ff] tracking-wider uppercase mb-1 font-bold">
                  Coleção Completa com Capas Temáticas
                </div>
                <h2 className="text-2xl font-extrabold text-[#00f5ff] neon-text-glow">
                  Catálogo de Jogos Retrô
                </h2>
              </div>

              {/* Functional interactive filter tabs */}
              <div className="flex flex-wrap items-center gap-1 p-1 bg-[#331454]/90 rounded-lg border border-[#7e3bbd]/70">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'puzzle', label: 'Puzzle / Quiz' },
                  { id: 'esportes', label: 'Esportes' },
                  { id: 'luta', label: 'Luta / Boxe' },
                  { id: 'arcade', label: 'Arcade' },
                  { id: 'ação', label: 'Ação' },
                  { id: 'mesa', label: 'Mesa' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${
                      activeFilter === tab.id
                        ? 'bg-[#00f5ff] text-[#1a072f] shadow-sm'
                        : 'text-[#a5f3fc] hover:text-[#00f5ff]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid with Game Covers */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  isSelected={selectedGame.id === game.id}
                  onSelect={handleSelectGame}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Editorial History & Curiosities Section */}
        <section id="regras" className="py-16 px-4 sm:px-6 max-w-6xl mx-auto border-t border-[#7e3bbd]/60">
          <div className="max-w-2xl mb-10">
            <div className="text-xs font-mono text-[#00f5ff] uppercase tracking-wider mb-2 font-bold">
              História & Curiosidades
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#00f5ff] neon-text-glow mb-3">
              Como esses clássicos transformaram o entretenimento
            </h2>
            <p className="text-sm text-[#a5f3fc] leading-relaxed">
              Antes dos gráficos 3D hiper-realistas, a engenhosidade humana brilhava em hardware com poucos kilobytes de memória e resoluções mínimas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2 p-4 rounded-xl bg-[#2e124d]/70 border border-[#6e35a7]/50">
              <h3 className="text-sm font-bold text-[#00f5ff]">
                01. A Revolução do Tênis & Grand Slam
              </h3>
              <p className="text-xs text-[#a5f3fc]/80 leading-relaxed">
                Desde o pioneiro Pong até as lendas dos 16-bits, a física de quique em saibro, grama e concreto definiu ralis táticos, efeitos cortados e saques potentes que marcaram gerações.
              </p>
            </div>

            <div className="space-y-2 p-4 rounded-xl bg-[#2e124d]/70 border border-[#6e35a7]/50">
              <h3 className="text-sm font-bold text-[#00f5ff]">
                02. Dedução & Enigmas Históricos
              </h3>
              <p className="text-xs text-[#a5f3fc]/80 leading-relaxed">
                Jogos clássicos de perguntas de Sim ou Não (20 Perguntas e Cara a Cara) aguçaram o raciocínio investigativo de cientistas, inventores e detetives ao longo das décadas.
              </p>
            </div>

            <div className="space-y-2 p-4 rounded-xl bg-[#2e124d]/70 border border-[#6e35a7]/50">
              <h3 className="text-sm font-bold text-[#00f5ff]">
                03. A Lenda dos Barris de Kong
              </h3>
              <p className="text-xs text-[#a5f3fc]/80 leading-relaxed">
                Em 1981, Shigeru Miyamoto revolucionou a indústria com Donkey Kong ao inventar a ação de pular sobre obstáculos (Jumpman / Mário) e criar o primeiro enredo narrativo dos videogames.
              </p>
            </div>

            <div className="space-y-2 p-4 rounded-xl bg-[#2e124d]/70 border border-[#6e35a7]/50">
              <h3 className="text-sm font-bold text-[#00f5ff]">
                04. A Matemática Perfeita de Tetris
              </h3>
              <p className="text-xs text-[#a5f3fc]/80 leading-relaxed">
                Criado em Moscou em 1984 num computador soviético Elektronika 60, Tetris explora o instinto humano de organização geométrica com 7 peças compostas por 4 blocos (tetrominoes).
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Clean quiet Footer */}
      <footer className="w-full bg-[#1c0830] border-t border-[#7e3bbd]/60 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#67e8f9] font-mono">
          <div>
            <span>Arcade Clássicos · Lilás & Azul Neon · Capas Temáticas</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#arena" className="hover:text-[#00f5ff] transition-colors">
              Voltar ao Topo
            </a>
            <a href="#jogos" className="hover:text-[#00f5ff] transition-colors">
              Jogos
            </a>
            <a href="#regras" className="hover:text-[#00f5ff] transition-colors">
              História
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
