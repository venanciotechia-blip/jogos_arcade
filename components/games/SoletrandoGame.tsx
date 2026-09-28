'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { HelpCircle, Trophy, Sparkles, AlertCircle, RotateCcw, CheckCircle2, Award, Zap, Shuffle, Volume2 } from 'lucide-react';
import { sound } from '@/lib/sound';
import { getHighScore, saveHighScore } from '@/lib/gameStore';

interface WordItem {
  word: string;
  normalized: string;
  theme: string;
  class: string;
  meaning: string;
  example: string;
  difficulty: 1 | 2 | 3 | 4;
}

const PRIZE_LADDER = [
  { tier: 1, prize: 5000, label: '5 Mil Barras' },
  { tier: 2, prize: 10000, label: '10 Mil Barras' },
  { tier: 3, prize: 25000, label: '25 Mil Barras' },
  { tier: 4, prize: 50000, label: '50 Mil Barras' },
  { tier: 5, prize: 100000, label: '100 Mil Barras' },
  { tier: 6, prize: 300000, label: '300 Mil Barras' },
  { tier: 7, prize: 500000, label: '500 Mil Barras' },
  { tier: 8, prize: 1000000, label: '1 MILHÃO DE BARRAS!' },
];

const WORDS_DATABASE: WordItem[] = [
  // Tier 1 (Fácil)
  {
    word: 'PIRULITO',
    normalized: 'PIRULITO',
    theme: 'Doces & Guloseimas',
    class: 'Substantivo masculino',
    meaning: 'Guloseima açucarada presa a uma haste plástica ou de madeira.',
    example: 'A criança saboreou um doce colorido no parque infantil.',
    difficulty: 1,
  },
  {
    word: 'TRAVESSEIRO',
    normalized: 'TRAVESSEIRO',
    theme: 'Cama & Quarto',
    class: 'Substantivo masculino',
    meaning: 'Peça macia e acolchoada usada para apoiar a cabeça ao dormir.',
    example: 'Ele colocou a cabeça na almofada macia e adormeceu.',
    difficulty: 1,
  },
  {
    word: 'BICICLETA',
    normalized: 'BICICLETA',
    theme: 'Transporte & Lazer',
    class: 'Substantivo feminino',
    meaning: 'Veículo de duas rodas alinhadas movido pelo esforço das pernas.',
    example: 'Pedalar na ciclovia aos domingos é um ótimo exercício.',
    difficulty: 1,
  },
  {
    word: 'BORBOLETA',
    normalized: 'BORBOLETA',
    theme: 'Animais & Insetos',
    class: 'Substantivo feminino',
    meaning: 'Inseto voador com quatro asas de escamas coloridas e metamorfose.',
    example: 'A criatura de asas azuis pousou delicadamente sobre a flor.',
    difficulty: 1,
  },
  {
    word: 'CHOCOLATE',
    normalized: 'CHOCOLATE',
    theme: 'Sobremesas & Doces',
    class: 'Substantivo masculino',
    meaning: 'Alimento doce feito com massa e manteiga de cacau moído.',
    example: 'Ela ganhou uma caixa de bombons ao comemorar o aniversário.',
    difficulty: 1,
  },
  {
    word: 'GELADEIRA',
    normalized: 'GELADEIRA',
    theme: 'Eletrodomésticos',
    class: 'Substantivo feminino',
    meaning: 'Aparelho refrigerador para conservar alimentos e bebidas frias.',
    example: 'Guardou a jarra de suco fresco para refrescar no calor.',
    difficulty: 1,
  },

  // Tier 2 (Médio)
  {
    word: 'EXCEÇÃO',
    normalized: 'EXCECAO',
    theme: 'Regras & Linguagem',
    class: 'Substantivo feminino',
    meaning: 'Ato de excluir; caso que não segue a regra comum.',
    example: 'Todos os alunos foram aprovados, sem nenhum caso divergente.',
    difficulty: 2,
  },
  {
    word: 'ANSIEDADE',
    normalized: 'ANSIEDADE',
    theme: 'Sentimentos & Emoções',
    class: 'Substantivo feminino',
    meaning: 'Sensação de inquietação ou nervosismo em antecipação a um evento.',
    example: 'Sentiu o coração acelerado antes de começar a grande apresentação.',
    difficulty: 2,
  },
  {
    word: 'ENXURRADA',
    normalized: 'ENXURRADA',
    theme: 'Clima & Chuvas',
    class: 'Substantivo feminino',
    meaning: 'Grande corrente de água e lama provocada por temporal intenso.',
    example: 'A torrente pluvial desceu velozmente ladeira abaixo.',
    difficulty: 2,
  },
  {
    word: 'BENFEITOR',
    normalized: 'BENFEITOR',
    theme: 'Boas Ações & Sociedade',
    class: 'Substantivo masculino',
    meaning: 'Pessoa generosa que realiza obras de caridade ou ajuda ao próximo.',
    example: 'O ilustre cidadão financiou a reforma da biblioteca comunitária.',
    difficulty: 2,
  },
  {
    word: 'ASTRONAUTA',
    normalized: 'ASTRONAUTA',
    theme: 'Profissões & Espaço',
    class: 'Substantivo de dois gêneros',
    meaning: 'Profissional treinado para viajar e trabalhar em naves espaciais.',
    example: 'O explorador realizou uma caminhada fora da estação orbital.',
    difficulty: 2,
  },

  // Tier 3 (Difícil)
  {
    word: 'PARALISIA',
    normalized: 'PARALISIA',
    theme: 'Saúde & Medicina',
    class: 'Substantivo feminino',
    meaning: 'Perda total ou parcial da capacidade de movimentar músculos.',
    example: 'A campanha de vacinação previne o surgimento dessa enfermidade motora.',
    difficulty: 3,
  },
  {
    word: 'REIVINDICAR',
    normalized: 'REIVINDICAR',
    theme: 'Cidadania & Direitos',
    class: 'Verbo transitivo',
    meaning: 'Exigir formalmente o cumprimento de um direito legítimo.',
    example: 'Os representantes sindicais foram exigir melhorias de segurança.',
    difficulty: 3,
  },
  {
    word: 'ESDRÚXULO',
    normalized: 'ESDRUXULO',
    theme: 'Expressões Curiosas',
    class: 'Adjetivo',
    meaning: 'Fora do comum, extravagante, excêntrico ou bizarro.',
    example: 'Apresentou um projeto tão excêntrico que surpreendeu o júri.',
    difficulty: 3,
  },
  {
    word: 'DISCERNIMENTO',
    normalized: 'DISCERNIMENTO',
    theme: 'Sabedoria & Juízo',
    class: 'Substantivo masculino',
    meaning: 'Capacidade de avaliar situações com clareza, bom senso e prudência.',
    example: 'O juiz demonstrou grande sabedoria ao proferir o veredito imparcial.',
    difficulty: 3,
  },

  // Tier 4 (Desafio Supremo do Milhão)
  {
    word: 'CONDESCENDÊNCIA',
    normalized: 'CONDESCENDENCIA',
    theme: 'Comportamento Humano',
    class: 'Substantivo feminino',
    meaning: 'Facilidade para ceder aos desejos de alguém por benevolência ou tolerância.',
    example: 'O mestre agiu com grande tolerância e paciência perante os aprendizes.',
    difficulty: 4,
  },
  {
    word: 'INEXPUGNÁVEL',
    normalized: 'INEXPUGNAVEL',
    theme: 'Fortalezas & Defesas',
    class: 'Adjetivo',
    meaning: 'Que não pode ser vencido, tomado ou conquistado pela força.',
    example: 'O antigo castelo de pedras maciças resistiu a todos os cercos.',
    difficulty: 4,
  },
  {
    word: 'IDIOSSINCRASIA',
    normalized: 'IDIOSSINCRASIA',
    theme: 'Personalidade & Estilo',
    class: 'Substantivo feminino',
    meaning: 'Traço comportamental particular e distintivo de um indivíduo.',
    example: 'Seus hábitos matinais peculiares faziam parte do seu modo de ser.',
    difficulty: 4,
  },
  {
    word: 'INCONSTITUCIONALIDADE',
    normalized: 'INCONSTITUCIONALIDADE',
    theme: 'Direito & Leis do País',
    class: 'Substantivo feminino',
    meaning: 'Condição de um ato ou lei que fere a Constituição nacional.',
    example: 'A suprema corte julgou a norma incompatível com a carta magna.',
    difficulty: 4,
  },
];

const SILVIO_PHRASES = [
  'Ma-ôe! Quem quer dinheiro?!',
  'Olhe o tema da palavra logo abaixo das letras!',
  'É bom ou não é?!',
  'Preencha as letras que faltam para faturar as barras de ouro!',
  'Está certo disso? Posso perguntar?',
  'Ha-hai! Ceeeerta resposta!',
  'Errou feio, errou rude!',
  'Do mil ao milhão, só no Baú da Felicidade!',
];

function normalizeChar(char: string): string {
  return char
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

// Speak host phrases, but NEVER speak the secret word!
function speakHost(text: string) {
  if (typeof window === 'undefined') return;
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.88;
    utterance.pitch = 1.15; // Silvio energetic host pitch
    window.speechSynthesis.speak(utterance);
  } catch {
    // blocked or not supported
  }
}

// Generates starter hint letter indices (~35-45% of positions)
function generateStarterIndices(normWord: string): number[] {
  const len = normWord.length;
  // Choose count: between 3 and 7 letters
  const count = Math.max(2, Math.min(len - 2, Math.floor(len * 0.4)));
  const result: number[] = [];

  // Anchor the first or second letter
  result.push(0);

  // Evenly space remaining starter letters
  const step = Math.max(2, Math.floor(len / count));
  for (let i = step; i < len; i += step) {
    if (result.length < count && !result.includes(i)) {
      result.push(i);
    }
  }

  // If we still need more to reach count, pick non-consecutive
  for (let i = 1; i < len - 1 && result.length < count; i++) {
    if (!result.includes(i) && !result.includes(i - 1)) {
      result.push(i);
    }
  }

  return result.sort((a, b) => a - b);
}

export function SoletrandoGame() {
  const [currentTierIndex, setCurrentTierIndex] = useState(0);
  const [currentWord, setCurrentWord] = useState<WordItem>(WORDS_DATABASE[0]);
  const [revealedIndices, setRevealedIndices] = useState<number[]>([]);
  const [userSlots, setUserSlots] = useState<string[]>([]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(1);
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'CONFIRMING' | 'CORRECT' | 'WRONG' | 'MILLIONAIRE'>('IDLE');
  const [silvioSpeech, setSilvioSpeech] = useState<string>('Ma-ôe! Bem-vindo à Palavra Misteriosa! Olhe o tema abaixo!');
  const [eliminatedKeys, setEliminatedKeys] = useState<string[]>([]);

  // Lifelines
  const [giveLetterCount, setGiveLetterCount] = useState(2); // can ask for 2 extra letters per game
  const [helpLettersUsed, setHelpLettersUsed] = useState(false);
  const [helpSkipUsed, setHelpSkipUsed] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);

  const [highScore, setHighScore] = useState<number>(() => getHighScore('soletrando'));

  // Pick word for tier
  const pickWordForTier = useCallback((tierIndex: number): WordItem => {
    let diffTarget: 1 | 2 | 3 | 4 = 1;
    if (tierIndex >= 6) diffTarget = 4;
    else if (tierIndex >= 4) diffTarget = 3;
    else if (tierIndex >= 2) diffTarget = 2;
    else diffTarget = 1;

    const available = WORDS_DATABASE.filter((w) => w.difficulty === diffTarget);
    return available[Math.floor(Math.random() * available.length)] || WORDS_DATABASE[0];
  }, []);

  // Initialize a new word round with revealed letters
  const setupWordRound = useCallback((wordItem: WordItem, tier: number) => {
    const starters = generateStarterIndices(wordItem.normalized);
    const initialSlots = Array.from({ length: wordItem.word.length }, (_, i) =>
      starters.includes(i) ? wordItem.normalized[i] : ''
    );

    setCurrentWord(wordItem);
    setRevealedIndices(starters);
    setUserSlots(initialSlots);
    setEliminatedKeys([]);
    setShowHintModal(false);

    // Set active cursor to first empty slot
    const firstBlank = initialSlots.findIndex((s) => s === '');
    setActiveSlotIndex(firstBlank !== -1 ? firstBlank : 0);

    const randomCatchphrase = SILVIO_PHRASES[Math.floor(Math.random() * SILVIO_PHRASES.length)];
    const prizeLabel = PRIZE_LADDER[tier]?.label || '5 Mil Barras';
    setSilvioSpeech(`${randomCatchphrase} Tema: "${wordItem.theme}". Complete as letras que faltam valendo ${prizeLabel}!`);

    // Voice announcement of the THEME only, never the word!
    speakHost(`Atenção para o tema: ${wordItem.theme}! Complete as letras que faltam valendo ${prizeLabel}!`);
  }, []);

  const startNewGame = useCallback(() => {
    const firstWord = pickWordForTier(0);
    setCurrentTierIndex(0);
    setGiveLetterCount(2);
    setHelpLettersUsed(false);
    setHelpSkipUsed(false);
    setGameState('PLAYING');
    sound.playClick();
    setupWordRound(firstWord, 0);
  }, [pickWordForTier, setupWordRound]);

  // Find next blank slot after current index
  const findNextBlankIndex = useCallback((currentIndex: number, slots: string[], starters: number[]): number => {
    for (let i = currentIndex + 1; i < slots.length; i++) {
      if (!starters.includes(i) && slots[i] === '') return i;
    }
    // wrap around to check beginning
    for (let i = 0; i <= currentIndex; i++) {
      if (!starters.includes(i) && slots[i] === '') return i;
    }
    return currentIndex;
  }, []);

  // Find previous blank slot
  const findPrevBlankIndex = useCallback((currentIndex: number, starters: number[]): number => {
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (!starters.includes(i)) return i;
    }
    return currentIndex;
  }, []);

  // Handle typing a letter into active slot
  const handleTypeLetter = useCallback((char: string) => {
    if (gameState !== 'PLAYING') return;

    setUserSlots((prevSlots) => {
      // Find a slot to write into: if active slot is valid and not revealed
      let targetIdx = activeSlotIndex;
      if (revealedIndices.includes(targetIdx) || prevSlots[targetIdx] !== '') {
        const nextBlank = prevSlots.findIndex((s, idx) => !revealedIndices.includes(idx) && s === '');
        if (nextBlank !== -1) targetIdx = nextBlank;
      }

      if (revealedIndices.includes(targetIdx)) return prevSlots;

      const newSlots = [...prevSlots];
      newSlots[targetIdx] = char.toUpperCase();
      sound.playMove();

      // Advance active cursor to the next blank slot
      const nextBlank = findNextBlankIndex(targetIdx, newSlots, revealedIndices);
      setActiveSlotIndex(nextBlank);

      return newSlots;
    });
  }, [gameState, activeSlotIndex, revealedIndices, findNextBlankIndex]);

  // Handle Backspace
  const handleBackspace = useCallback(() => {
    if (gameState !== 'PLAYING') return;

    setUserSlots((prevSlots) => {
      const newSlots = [...prevSlots];
      // If current slot has a user-typed letter and isn't a locked starter
      if (!revealedIndices.includes(activeSlotIndex) && newSlots[activeSlotIndex] !== '') {
        newSlots[activeSlotIndex] = '';
        sound.playClick();
        return newSlots;
      }

      // Otherwise, jump back to previous non-starter slot and clear it
      const prevBlank = findPrevBlankIndex(activeSlotIndex, revealedIndices);
      if (prevBlank !== activeSlotIndex && !revealedIndices.includes(prevBlank)) {
        newSlots[prevBlank] = '';
        setActiveSlotIndex(prevBlank);
        sound.playClick();
      }
      return newSlots;
    });
  }, [gameState, activeSlotIndex, revealedIndices, findPrevBlankIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'PLAYING') return;

      if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const isFull = userSlots.length > 0 && userSlots.every((s) => s !== '');
        if (isFull) {
          setGameState('CONFIRMING');
          sound.playBounce();
          setSilvioSpeech('Você está certo disso?! É a sua resposta definitiva?');
          speakHost('Você está certo disso? Posso perguntar?');
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveSlotIndex((curr) => findPrevBlankIndex(curr, revealedIndices));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveSlotIndex((curr) => findNextBlankIndex(curr, userSlots, revealedIndices));
      } else if (/^[a-zA-ZáéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]$/.test(e.key)) {
        e.preventDefault();
        handleTypeLetter(normalizeChar(e.key));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, userSlots, revealedIndices, handleTypeLetter, handleBackspace, findPrevBlankIndex, findNextBlankIndex]);

  // Silvio Lifeline 1: "Silvio, me dá uma letra!"
  const handleGiveOneLetter = () => {
    if (giveLetterCount <= 0 || gameState !== 'PLAYING') return;

    // Find indices that are not yet revealed
    const unrevealed = [];
    for (let i = 0; i < currentWord.normalized.length; i++) {
      if (!revealedIndices.includes(i)) {
        unrevealed.push(i);
      }
    }

    if (unrevealed.length <= 1) return; // leave at least one to guess!

    // Pick one random unrevealed index to reveal!
    const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    const letterToReveal = currentWord.normalized[pick];

    sound.playEat();
    setRevealedIndices((prev) => [...prev, pick].sort((a, b) => a - b));
    setUserSlots((prev) => {
      const next = [...prev];
      next[pick] = letterToReveal;
      return next;
    });
    setGiveLetterCount((c) => c - 1);
    setSilvioSpeech(`Ma-ôe! Silvio te deu uma letra de presente na posição ${pick + 1}!`);
    speakHost(`Ma-ôe! Lá vai uma letra de presente para ajudar no tema ${currentWord.theme}!`);
  };

  // Silvio Lifeline 2: Eliminate 3 wrong letters from the keyboard
  const handleEliminateLetters = () => {
    if (helpLettersUsed || gameState !== 'PLAYING') return;
    setHelpLettersUsed(true);
    sound.playEat();

    const wordLetters = new Set(currentWord.normalized.split(''));
    const allAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const wrongAlphabet = allAlphabet.filter((char) => !wordLetters.has(char));
    const toEliminate = wrongAlphabet.sort(() => 0.5 - Math.random()).slice(0, 3);
    setEliminatedKeys(toEliminate);
    setSilvioSpeech(`As cartas do auditório eliminaram 3 letras que NÃO existem: ${toEliminate.join(', ')}!`);
    speakHost(`Eliminamos três letras erradas do teclado para você: ${toEliminate.join(', ')}!`);
  };

  // Silvio Lifeline 3: Skip word
  const handleSkipWord = () => {
    if (helpSkipUsed || gameState !== 'PLAYING') return;
    setHelpSkipUsed(true);
    sound.playClear();
    const newWord = pickWordForTier(currentTierIndex);
    setupWordRound(newWord, currentTierIndex);
  };

  // Confirm Answer
  const handleConfirmAnswer = () => {
    const currentTypedNorm = userSlots.map(normalizeChar).join('');
    const targetNorm = currentWord.normalized;

    if (currentTypedNorm === targetNorm) {
      // CORRECT ANSWER!
      sound.playCorrectDing();
      sound.playCheer();
      const currentPrize = PRIZE_LADDER[currentTierIndex].prize;
      saveHighScore('soletrando', currentPrize);
      setHighScore((h) => Math.max(h, currentPrize));

      if (currentTierIndex >= PRIZE_LADDER.length - 1) {
        setGameState('MILLIONAIRE');
        setSilvioSpeech('PARABÉNS! VOCÊ ACABOU DE GANHAR 1 MILHÃO DE BARRAS DE OURO QUE VALEM MAIS DO QUE DINHEIRO!');
        speakHost('Parabéns! Você ganhou um milhão de barras de ouro que valem mais do que dinheiro!');
      } else {
        setGameState('CORRECT');
        setSilvioSpeech('Ha-hai! Ceeerta resposta! O auditório vai ao delírio!');
        speakHost('Certa resposta! Vamos para o próximo tema!');
      }
    } else {
      // WRONG ANSWER!
      sound.playBuzzer();
      setGameState('WRONG');
      setSilvioSpeech(`Errou feio, errou rude! A palavra correta era: ${currentWord.word}!`);
      speakHost(`Que pena, você errou! O tema era ${currentWord.theme}.`);
    }
  };

  const handleNextWord = () => {
    const nextTier = currentTierIndex + 1;
    const nextW = pickWordForTier(nextTier);
    setCurrentTierIndex(nextTier);
    setGameState('PLAYING');
    sound.playClick();
    setupWordRound(nextW, nextTier);
  };

  const isComplete = userSlots.length > 0 && userSlots.every((s) => s !== '');

  const ALPHABET_ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ç'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ];

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto font-sans">
      {/* Top TV Game-Show HUD */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border border-amber-800/50 rounded-t-2xl text-xs font-mono">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-amber-500 border border-amber-300 flex items-center justify-center text-slate-950 font-bold shadow-md">
            S
          </div>
          <div>
            <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
              VALENDO AGORA
            </div>
            <div className="text-sm sm:text-base font-black text-amber-300 tabular-nums">
              {PRIZE_LADDER[currentTierIndex]?.label || '5 Mil Barras'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-950/40 px-3 py-1 rounded-lg border border-amber-700/50 shadow-inner">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="font-bold tabular-nums">
              {highScore > 0 ? `${highScore.toLocaleString('pt-BR')} Barras` : 'Sem Recorde'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Stage Arena Viewport */}
      <div className="relative w-full min-h-[480px] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-x border-amber-900/40 p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
        {/* Silvio Avatar & Speech Bubble Area */}
        <div className="flex items-start gap-3 bg-slate-950/80 border border-amber-800/40 p-3 rounded-2xl shadow-xl">
          <div className="shrink-0 flex flex-col items-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-300 shadow-md flex items-center justify-center text-2xl relative overflow-hidden">
              🎙️
              <div className="absolute -bottom-1 w-full bg-slate-950/85 text-[8px] font-mono text-center text-amber-300 py-0.5 font-bold">
                SILVIO
              </div>
            </div>
          </div>

          <div className="flex-1 bg-amber-950/30 border border-amber-700/40 rounded-xl p-2.5">
            <p className="text-xs sm:text-sm text-amber-100 font-medium leading-relaxed italic">
              &ldquo;{silvioSpeech}&rdquo;
            </p>
          </div>
        </div>

        {/* Word Mystery Letter Slots */}
        <div className="my-3 flex flex-col items-center">
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 py-1 max-w-full">
            {userSlots.map((slotChar, idx) => {
              const isStarter = revealedIndices.includes(idx);
              const isActive = idx === activeSlotIndex && gameState === 'PLAYING';

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (!isStarter && gameState === 'PLAYING') {
                      setActiveSlotIndex(idx);
                      sound.playClick();
                    }
                  }}
                  className={`relative w-8 h-10 sm:w-10 sm:h-13 rounded-xl font-mono font-black text-lg sm:text-xl flex flex-col items-center justify-center border-2 transition-all select-none ${
                    isStarter
                      ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-md shadow-amber-500/20 cursor-default'
                      : isActive
                      ? 'bg-slate-900 border-amber-500 ring-2 ring-amber-400/50 text-white animate-pulse'
                      : slotChar
                      ? 'bg-blue-950/40 border-blue-400/80 text-blue-200'
                      : 'bg-slate-950 border-slate-800 text-slate-700 hover:border-slate-700'
                  }`}
                >
                  <span>{slotChar || ''}</span>
                  {isStarter && (
                    <span className="absolute bottom-0.5 text-[8px] text-amber-400 font-sans tracking-tighter">
                      PISTA
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* PROMINENT THEME DISPLAY UNDERNEATH THE LETTERS */}
          <div className="mt-3.5 w-full flex flex-col items-center">
            <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>TEMA DA PALAVRA</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>

            <div className="px-6 py-2 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/20 border-2 border-amber-400/80 text-amber-300 font-black text-sm sm:text-base tracking-wide uppercase shadow-lg shadow-amber-500/15 flex items-center gap-2.5">
              <span className="text-base">🏷️</span>
              <span>{currentWord.theme}</span>
            </div>

            <p className="text-[11px] text-slate-400 mt-1.5 font-mono text-center">
              As letras marcadas com <strong className="text-amber-300">PISTA</strong> já foram reveladas. Complete os espaços em branco!
            </p>
          </div>
        </div>

        {/* Action & Lifelines Bar (Ajudas do Silvio) */}
        <div className="flex flex-wrap items-center justify-center gap-2 my-2">
          {/* Silvio me dá uma letra */}
          <button
            type="button"
            onClick={handleGiveOneLetter}
            disabled={giveLetterCount <= 0 || gameState !== 'PLAYING'}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border shadow-sm transition-all ${
              giveLetterCount <= 0
                ? 'opacity-40 bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/60 active:scale-95'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Me dá uma letra! ({giveLetterCount})</span>
          </button>

          {/* Dica de Significado */}
          <button
            type="button"
            onClick={() => setShowHintModal((prev) => !prev)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>Ver Definição</span>
          </button>

          {/* Eliminar 3 letras */}
          <button
            type="button"
            onClick={handleEliminateLetters}
            disabled={helpLettersUsed || gameState !== 'PLAYING'}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              helpLettersUsed
                ? 'opacity-40 bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
            }`}
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Eliminar 3 Letras</span>
          </button>

          {/* Pular */}
          <button
            type="button"
            onClick={handleSkipWord}
            disabled={helpSkipUsed || gameState !== 'PLAYING'}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              helpSkipUsed
                ? 'opacity-40 bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
            }`}
          >
            <Shuffle className="w-3 h-3 text-purple-400" />
            <span>Pular</span>
          </button>

          {/* Ouvir Tema com voz do Silvio */}
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              speakHost(`O tema da palavra é: ${currentWord.theme}! Preencha as letras que faltam!`);
            }}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700"
            title="Ouvir Silvio falar o Tema"
          >
            <Volume2 className="w-4 h-4 text-amber-400" />
          </button>
        </div>

        {/* On-screen Virtual Keyboard */}
        <div className="flex flex-col items-center gap-1 my-1">
          {ALPHABET_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="flex gap-1 justify-center w-full">
              {row.map((char) => {
                const isEliminated = eliminatedKeys.includes(char);
                return (
                  <button
                    key={char}
                    type="button"
                    disabled={isEliminated || gameState !== 'PLAYING'}
                    onClick={() => handleTypeLetter(char)}
                    className={`w-7 sm:w-9 h-9 sm:h-10 rounded-lg font-mono font-bold text-xs sm:text-sm transition-all ${
                      isEliminated
                        ? 'opacity-20 bg-slate-900 text-slate-600 cursor-not-allowed line-through'
                        : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 active:scale-95 border border-slate-750'
                    }`}
                  >
                    {char}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Bottom Action Row: Backspace + Confirm Button */}
          <div className="flex gap-2 mt-2 w-full max-w-xs">
            <button
              type="button"
              onClick={handleBackspace}
              disabled={gameState !== 'PLAYING'}
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-slate-300 border border-slate-700 transition-colors"
            >
              Apagar (⌫)
            </button>

            <button
              type="button"
              disabled={gameState !== 'PLAYING' || !isComplete}
              onClick={() => {
                setGameState('CONFIRMING');
                sound.playBounce();
                setSilvioSpeech('Você está certo disso?! É a sua resposta definitiva?');
                speakHost('Você está certo disso? Posso perguntar?');
              }}
              className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 active:scale-95 transition-all"
            >
              Confirmar Resposta
            </button>
          </div>
        </div>

        {/* Start Game Overlay */}
        {gameState === 'IDLE' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-3xl mb-4 shadow-xl shadow-amber-500/20 animate-bounce">
              🎙️
            </div>
            <h3 className="text-2xl font-black text-white mb-1">Palavra Misteriosa</h3>
            <p className="text-xs text-amber-300 font-mono mb-3 uppercase tracking-widest">
              Show do Silvio Santos · 1 Milhão em Barras de Ouro!
            </p>
            <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
              A palavra é secreta! Você terá algumas letras já reveladas como pistas e o <strong className="text-amber-300">TEMA</strong> colocado embaixo. Complete as letras restantes para faturar a barra de ouro!
            </p>
            <button
              onClick={startNewGame}
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/30 active:scale-95 transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 fill-current" />
              Entrar no Palco e Jogar!
            </button>
          </div>
        )}

        {/* Confirmation Modal ("Está certo disso?!") */}
        {gameState === 'CONFIRMING' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-2xl mb-3">
              ❓
            </div>
            <h3 className="text-2xl font-black text-white mb-2">&ldquo;Está certo disso?!&rdquo;</h3>
            <p className="text-xs text-slate-300 font-mono mb-4">
              Sua resposta: <span className="text-amber-400 font-bold tracking-widest">{userSlots.join('')}</span>
            </p>
            <p className="text-xs text-slate-400 max-w-xs mb-6">
              Posso perguntar? Se acertar, você fatura a barra de ouro!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setGameState('PLAYING')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Voltar e Corrigir
              </button>
              <button
                onClick={handleConfirmAnswer}
                className="px-6 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20"
              >
                Sim! Certa Resposta!
              </button>
            </div>
          </div>
        )}

        {/* Correct Answer Modal */}
        {gameState === 'CORRECT' && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 text-2xl mb-3 animate-pulse">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="text-xs font-mono text-emerald-400 tracking-widest font-bold mb-1">
              HA-HAI! CERTA RESPOSTA!
            </div>
            <h3 className="text-2xl font-black text-white mb-1">{currentWord.word}</h3>
            <p className="text-xs text-slate-400 font-mono mb-2">Tema: {currentWord.theme}</p>
            <p className="text-xs text-amber-300 font-mono mb-6 font-bold">
              Você garantiu {PRIZE_LADDER[currentTierIndex].label}!
            </p>
            <button
              onClick={handleNextWord}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <span>Próxima Palavra</span>
              <Award className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Wrong Answer Modal */}
        {gameState === 'WRONG' && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-400 flex items-center justify-center text-red-400 text-2xl mb-3">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="text-xs font-mono text-red-500 tracking-widest font-bold mb-1">
              ERROU FEIO, ERROU RUDE!
            </div>
            <h3 className="text-xl font-black text-white mb-1">A palavra era: {currentWord.word}</h3>
            <p className="text-xs text-slate-400 mb-1">Tema: {currentWord.theme}</p>
            <p className="text-xs text-slate-400 mb-4">Você preencheu: {userSlots.join('')}</p>
            <button
              onClick={startNewGame}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Millionaire Victory Modal */}
        {gameState === 'MILLIONAIRE' && (
          <div className="absolute inset-0 bg-gradient-to-b from-amber-950 via-slate-950 to-slate-950 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 animate-fade-in">
            <div className="text-4xl mb-2 animate-bounce">🏆 💰 💵</div>
            <div className="text-xs font-mono text-amber-400 tracking-widest font-bold mb-1">
              É CAMPEÃO! 1 MILHÃO DE BARRAS DE OURO!
            </div>
            <h3 className="text-3xl font-black text-white mb-2">
              Você Ganhou o Prêmio Máximo!
            </h3>
            <p className="text-xs text-amber-200/90 max-w-xs mb-6 leading-relaxed">
              O auditório joga aviõezinhos de dinheiro e aplaude de pé! Você dominou todos os temas e palavras misteriosas!
            </p>
            <button
              onClick={startNewGame}
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/30 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Jogar Novamente
            </button>
          </div>
        )}

        {/* Hint Modal: Definition (Without spoiling the word!) */}
        {showHintModal && (
          <div className="absolute inset-x-4 top-16 bg-slate-900 border-2 border-amber-600/60 rounded-2xl p-4 shadow-2xl z-30 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-400 font-mono">DICA DE DEFINIÇÃO</span>
              <button
                onClick={() => setShowHintModal(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
              >
                ✕ Fechar
              </button>
            </div>
            <p className="text-xs text-slate-200 mb-2 leading-relaxed">
              <span className="font-semibold text-amber-300">Significado:</span> {currentWord.meaning}
            </p>
            <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <span className="font-semibold text-amber-400 not-italic">Exemplo:</span> &ldquo;{currentWord.example}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Bottom Bar: Quick Controls & Prize Steps */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-b-2xl p-3 flex flex-col gap-2">
        {/* Prize Escalator Progress */}
        <div className="flex items-center justify-between overflow-x-auto gap-1 py-1 text-[10px] font-mono scrollbar-none">
          {PRIZE_LADDER.map((step, idx) => {
            const isCompleted = idx < currentTierIndex;
            const isCurrent = idx === currentTierIndex;
            return (
              <div
                key={step.tier}
                className={`px-2 py-0.5 rounded whitespace-nowrap border text-center transition-all ${
                  isCurrent
                    ? 'bg-amber-500 text-slate-950 font-black border-amber-400 shadow-sm'
                    : isCompleted
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40 font-bold'
                    : 'bg-slate-950/60 text-slate-500 border-slate-850'
                }`}
              >
                {step.label.split(' ')[0]}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800">
          <button
            onClick={startNewGame}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reiniciar Jogo
          </button>

          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
            Clique nas lacunas vazias ou use o teclado para digitar
          </span>
        </div>
      </div>
    </div>
  );
}
