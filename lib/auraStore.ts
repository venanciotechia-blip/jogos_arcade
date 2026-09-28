'use client';

import { useState, useEffect, useCallback } from 'react';
import { sound } from './sound';

export type AuraDifficulty = 'FACIL' | 'MEDIO' | 'DIFICIL';

export interface AuraRank {
  level: number;
  title: string;
  minAura: number;
  maxAura: number;
  badge: string;
}

export const AURA_RANKS: AuraRank[] = [
  { level: 1, title: 'Iniciante dos Botecos', minAura: 0, maxAura: 300, badge: '🕹️' },
  { level: 2, title: 'Aprendiz de Fliperama', minAura: 300, maxAura: 800, badge: '⚡' },
  { level: 3, title: 'Rei das Fichas', minAura: 800, maxAura: 1600, badge: '🪙' },
  { level: 4, title: 'Mestre da Alavanca', minAura: 1600, maxAura: 2800, badge: '🥊' },
  { level: 5, title: 'Lenda dos 8-Bits', minAura: 2800, maxAura: 4500, badge: '🏆' },
  { level: 6, title: 'Super Saiyajin da Aura', minAura: 4500, maxAura: 7000, badge: '🔥' },
  { level: 7, title: 'Deus da Aura Farmada', minAura: 7000, maxAura: 100000, badge: '👑' },
];

export const DIFFICULTY_CONFIG: Record<
  AuraDifficulty,
  {
    name: string;
    points: number;
    multiplierText: string;
    description: string;
    color: string;
    badgeColor: string;
    tag: string;
  }
> = {
  FACIL: {
    name: 'Fácil',
    points: 100,
    multiplierText: '+100 Aura',
    description: 'Partidas leves e descontraídas',
    color: '#22c55e',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    tag: 'Casual',
  },
  MEDIO: {
    name: 'Médio',
    points: 250,
    multiplierText: '+250 Aura (2.5x)',
    description: 'Desafio equilibrado dos fliperamas',
    color: '#eab308',
    badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    tag: 'Desafiante',
  },
  DIFICIL: {
    name: 'Difícil',
    points: 600,
    multiplierText: '+600 Aura (6x!)',
    description: 'Modo Hardcore · Ativa "FARMOU DEMAIS SLK"',
    color: '#ef4444',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/50 shadow-red-500/20',
    tag: 'STREET FIGHTER MODE',
  },
};

const STORAGE_AURA_KEY = 'arcade_aura_total';
const STORAGE_DIFF_KEY = 'arcade_aura_difficulty';

export function getTotalAura(): number {
  if (typeof window === 'undefined') return 0;
  const val = localStorage.getItem(STORAGE_AURA_KEY);
  return val ? parseInt(val, 10) || 0 : 0;
}

export function getAuraDifficulty(): AuraDifficulty {
  if (typeof window === 'undefined') return 'MEDIO';
  const val = localStorage.getItem(STORAGE_DIFF_KEY) as AuraDifficulty | null;
  if (val && ['FACIL', 'MEDIO', 'DIFICIL'].includes(val)) {
    return val;
  }
  return 'MEDIO';
}

export function setAuraDifficulty(diff: AuraDifficulty): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_DIFF_KEY, diff);
  window.dispatchEvent(new CustomEvent('arcade_difficulty_changed', { detail: { difficulty: diff } }));
}

export interface AuraLevelInfo {
  level: number;
  title: string;
  badge: string;
  currentLevelAura: number;
  levelSpan: number;
  progressPercent: number;
  nextRankTitle: string;
  totalAura: number;
}

export function getAuraLevelInfo(totalAura: number): AuraLevelInfo {
  let rank = AURA_RANKS[0];
  let nextRank = AURA_RANKS[1];

  for (let i = 0; i < AURA_RANKS.length; i++) {
    if (totalAura >= AURA_RANKS[i].minAura) {
      rank = AURA_RANKS[i];
      nextRank = AURA_RANKS[i + 1] || AURA_RANKS[i];
    }
  }

  const currentLevelAura = Math.max(0, totalAura - rank.minAura);
  const levelSpan = Math.max(1, rank.maxAura - rank.minAura);
  const progressPercent = Math.min(100, Math.round((currentLevelAura / levelSpan) * 100));

  return {
    level: rank.level,
    title: rank.title,
    badge: rank.badge,
    currentLevelAura,
    levelSpan,
    progressPercent,
    nextRankTitle: nextRank.title,
    totalAura,
  };
}

export interface AuraWinEventDetail {
  gameName: string;
  difficulty: AuraDifficulty;
  gained: number;
  newTotal: number;
  isHard: boolean;
}

export function awardAuraWin(gameName: string, overrideDifficulty?: AuraDifficulty): AuraWinEventDetail {
  if (typeof window === 'undefined') {
    return { gameName, difficulty: 'MEDIO', gained: 250, newTotal: 250, isHard: false };
  }

  const diff = overrideDifficulty || getAuraDifficulty();
  const gained = DIFFICULTY_CONFIG[diff].points;
  const current = getTotalAura();
  const newTotal = current + gained;

  localStorage.setItem(STORAGE_AURA_KEY, String(newTotal));

  const isHard = diff === 'DIFICIL';

  const detail: AuraWinEventDetail = {
    gameName,
    difficulty: diff,
    gained,
    newTotal,
    isHard,
  };

  // Play audio
  if (isHard) {
    sound.playStreetFighterKO();
  } else {
    sound.playAuraGain();
  }

  // Notify UI
  window.dispatchEvent(new CustomEvent('aura_updated', { detail }));

  if (isHard) {
    window.dispatchEvent(new CustomEvent('aura_street_fighter_its_over', { detail }));
  }

  return detail;
}

export interface DefeatEventDetail {
  gameName: string;
  message: string;
  timestamp: number;
}

export function triggerDefeat(gameName: string): DefeatEventDetail {
  const detail: DefeatEventDetail = {
    gameName: gameName || 'Arcade',
    message: 'ala o betinha kkkk',
    timestamp: Date.now(),
  };

  if (typeof window !== 'undefined') {
    sound.playStreetFighterDefeat();
    window.dispatchEvent(new CustomEvent('arcade_defeat_its_over', { detail }));
  }

  return detail;
}

export function useAura() {
  const [totalAura, setTotalAura] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return getTotalAura();
  });
  const [difficulty, setDifficultyState] = useState<AuraDifficulty>(() => {
    if (typeof window === 'undefined') return 'MEDIO';
    return getAuraDifficulty();
  });
  const [lastGain, setLastGain] = useState<{ amount: number; gameName: string; timestamp: number } | null>(null);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<AuraWinEventDetail>;
      if (customEvent.detail) {
        setTotalAura(customEvent.detail.newTotal);
        setLastGain({
          amount: customEvent.detail.gained,
          gameName: customEvent.detail.gameName,
          timestamp: Date.now(),
        });
      } else {
        setTotalAura(getTotalAura());
      }
    };

    const handleDiffChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ difficulty: AuraDifficulty }>;
      if (customEvent.detail?.difficulty) {
        setDifficultyState(customEvent.detail.difficulty);
      }
    };

    window.addEventListener('aura_updated', handleUpdate);
    window.addEventListener('arcade_difficulty_changed', handleDiffChange);
    return () => {
      window.removeEventListener('aura_updated', handleUpdate);
      window.removeEventListener('arcade_difficulty_changed', handleDiffChange);
    };
  }, []);

  const changeDifficulty = useCallback((newDiff: AuraDifficulty) => {
    setDifficultyState(newDiff);
    setAuraDifficulty(newDiff);
    sound.playClick();
  }, []);

  const levelInfo = getAuraLevelInfo(totalAura);

  return {
    totalAura,
    difficulty,
    changeDifficulty,
    levelInfo,
    lastGain,
    awardWin: awardAuraWin,
    triggerDefeat,
  };
}
