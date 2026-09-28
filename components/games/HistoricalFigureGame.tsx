'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  HISTORICAL_FIGURES,
  HistoricalFigure,
  HistoricalCategory,
} from '@/lib/historicalFigures';
import { sound } from '@/lib/sound';
import { saveHighScore, getHighScore } from '@/lib/gameStore';
import { awardAuraWin } from '@/lib/auraStore';
import {
  HelpCircle,
  Send,
  Sparkles,
  RotateCcw,
  Lightbulb,
  CheckCircle2,
  UserCheck,
  BookOpen,
  Compass,
  Trophy,
  History,
  Lock,
} from 'lucide-react';

interface QuestionLog {
  id: string;
  question: string;
  verdict: 'SIM' | 'NÃO' | 'PROVAVELMENTE SIM' | 'PROVAVELMENTE NÃO' | 'NÃO SE APLICA' | 'ACERTOU!' | 'ERROU O PALPITE!';
  detail: string;
}

const QUICK_QUESTIONS = [
  'É do gênero feminino?',
  'Nasceu ou viveu no século XX?',
  'Nasceu no continente europeu?',
  'Atuou na área de Ciências ou Tecnologia?',
  'Ficou famoso nas Artes, Música ou Literatura?',
  'Foi um governante, monarca ou líder político?',
  'Nasceu no Brasil ou na América Latina?',
  'Recebeu a láurea do Prêmio Nobel?',
  'Viveu antes do ano de 1800?',
  'Escreveu livros ou tratados famosos?',
];

export function HistoricalFigureGame() {
  const [selectedCategory, setSelectedCategory] = useState<HistoricalCategory>('Todas as Áreas');
  const [currentFigure, setCurrentFigure] = useState<HistoricalFigure>(() => {
    return HISTORICAL_FIGURES[0];
  });
  const [questionInput, setQuestionInput] = useState('');
  const [guessInput, setGuessInput] = useState('');
  const [showGuessModal, setShowGuessModal] = useState(false);
  const [history, setHistory] = useState<QuestionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [revealedHints, setRevealedHints] = useState<number[]>([]);
  const [isWon, setIsWon] = useState(false);
  const [score, setScore] = useState(1000);
  const [highScore, setHighScore] = useState<number>(() => getHighScore('figura_historica'));

  const logCounterRef = useRef(1);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pick random figure
  const initRound = useCallback((category: HistoricalCategory = selectedCategory) => {
    let pool = HISTORICAL_FIGURES;
    if (category !== 'Todas as Áreas') {
      pool = HISTORICAL_FIGURES.filter((f) => f.category === category);
    }
    const randomIndex = Math.floor(Math.random() * pool.length);
    const chosen = pool[randomIndex] || HISTORICAL_FIGURES[0];

    setCurrentFigure(chosen);
    setHistory([]);
    setRevealedHints([]);
    setIsWon(false);
    setScore(1000);
    setQuestionInput('');
    setGuessInput('');
    setShowGuessModal(false);
    sound.playStart();
  }, [selectedCategory]);

  // Scroll to latest question
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, isLoading]);

  const handleCategoryChange = (cat: HistoricalCategory) => {
    setSelectedCategory(cat);
    initRound(cat);
  };

  const handleVictory = useCallback(() => {
    setIsWon(true);
    sound.playWin();
    const finalScore = Math.max(150, score - revealedHints.length * 80);
    const newHigh = Math.max(highScore, finalScore);
    saveHighScore('figura_historica', newHigh);
    setHighScore(newHigh);
    awardAuraWin('Enigma Histórico');
  }, [score, revealedHints.length, highScore]);

  // Submit question or direct guess
  const askQuestion = async (queryText: string, isDirectGuess = false) => {
    const trimmed = queryText.trim();
    if (!trimmed || isLoading || isWon) return;

    setIsLoading(true);
    sound.playMove();

    try {
      const res = await fetch('/api/historical-guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPerson: {
            name: currentFigure.name,
            era: currentFigure.era,
            field: currentFigure.field,
            nationality: currentFigure.nationality,
            gender: currentFigure.gender,
            keyFacts: currentFigure.keyFacts,
          },
          question: trimmed,
          isGuess: isDirectGuess,
        }),
      });

      const data = await res.json();
      const verdict = data.verdict || (isDirectGuess ? 'ERROU O PALPITE!' : 'NÃO');
      const detail = data.detail || '';
      const isCorrect = Boolean(data.isCorrect);

      logCounterRef.current += 1;
      const newLog: QuestionLog = {
        id: `q_${logCounterRef.current}`,
        question: isDirectGuess ? `[PALPITE]: É ${trimmed}?` : trimmed,
        verdict,
        detail,
      };

      setHistory((prev) => [...prev, newLog]);

      if (isDirectGuess) {
        if (isCorrect) {
          handleVictory();
        } else {
          sound.playQuestionNo();
          setScore((s) => Math.max(100, s - 100));
        }
      } else {
        if (verdict.includes('SIM')) {
          sound.playQuestionYes();
        } else {
          sound.playQuestionNo();
        }
        setScore((s) => Math.max(100, s - 25));
      }
    } catch {
      // Fallback in case of network issue
      const isMatch = isDirectGuess && trimmed.toLowerCase().includes(currentFigure.name.toLowerCase().split(' ')[0]);
      logCounterRef.current += 1;
      if (isMatch) {
        handleVictory();
      } else {
        setHistory((prev) => [
          ...prev,
          {
            id: `q_${logCounterRef.current}`,
            question: trimmed,
            verdict: isDirectGuess ? 'ERROU O PALPITE!' : 'NÃO',
            detail: 'Registrado nos arquivos históricos.',
          },
        ]);
        sound.playQuestionNo();
      }
    } finally {
      setIsLoading(false);
      setQuestionInput('');
      setGuessInput('');
      setShowGuessModal(false);
    }
  };

  const unlockHint = (hintIndex: number) => {
    if (revealedHints.includes(hintIndex) || isWon) return;
    sound.playStamp();
    setRevealedHints((prev) => [...prev, hintIndex]);
    setScore((s) => Math.max(50, s - 75));
  };

  const getVerdictStyle = (verdict: QuestionLog['verdict']) => {
    if (verdict === 'ACERTOU!' || verdict === 'SIM' || verdict === 'PROVAVELMENTE SIM') {
      return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-emerald-950/50';
    }
    if (verdict === 'ERROU O PALPITE!' || verdict === 'NÃO' || verdict === 'PROVAVELMENTE NÃO') {
      return 'bg-rose-950/80 text-rose-300 border-rose-500/50 shadow-rose-950/50';
    }
    return 'bg-amber-950/80 text-amber-300 border-amber-500/50 shadow-amber-950/50';
  };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto font-sans select-none pb-8 text-[#00f5ff]">
      {/* Top Header Card */}
      <div className="w-full bg-[#2a1144] border border-[#7e3bbd]/70 rounded-2xl p-4 sm:p-5 shadow-2xl mb-4 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00f5ff]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00f5ff] to-[#0284c7] flex items-center justify-center shadow-lg shadow-[#00f5ff]/20 text-[#1b0730] font-black text-2xl">
              <History className="w-7 h-7 text-[#1b0730]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-wider text-[#00f5ff] font-mono neon-text-glow">
                  QUEM SOU EU?
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#00f5ff]/15 text-[#00f5ff] border border-[#00f5ff]/30">
                  Enigma Histórico
                </span>
              </div>
              <p className="text-xs text-[#a5f3fc]">
                Faça perguntas de Sim e Não para deduzir a figura misteriosa!
              </p>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-2 sm:gap-4 font-mono text-xs">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 flex flex-col items-center">
              <span className="text-[10px] text-slate-400 uppercase">Perguntas</span>
              <span className="text-amber-400 font-bold text-sm sm:text-base">
                {history.length}
              </span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 flex flex-col items-center">
              <span className="text-[10px] text-slate-400 uppercase">Pontos</span>
              <span className="text-emerald-400 font-bold text-sm sm:text-base">
                {score}
              </span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 flex flex-col items-center">
              <span className="text-[10px] text-slate-400 uppercase">Recorde</span>
              <span className="text-yellow-400 font-bold text-sm sm:text-base flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                {highScore}
              </span>
            </div>
          </div>
        </div>

        {/* Category Filters */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-mono text-[11px] whitespace-nowrap">Área:</span>
          {(
            [
              'Todas as Áreas',
              'Ciência & Tecnologia',
              'Artes & Literatura',
              'Líderes & Política',
              'Filosofia & Pensamento',
              'Pioneiros & Exploração',
            ] as HistoricalCategory[]
          ).map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-3 py-1 rounded-lg font-medium transition-all text-xs whitespace-nowrap flex items-center gap-1.5 ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}

          <button
            onClick={() => initRound()}
            className="ml-auto text-xs px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 transition-colors font-mono"
            title="Sortear nova figura misteriosa"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            Nova Figura
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Mysterious Portrait Card & Secret Dossier */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-[#2a1144] border border-[#7e3bbd]/70 rounded-2xl p-5 shadow-xl flex flex-col items-center text-center relative overflow-hidden">
            <div className="w-full flex items-center justify-between text-[11px] font-mono text-[#a5f3fc] mb-3 border-b border-[#7e3bbd]/50 pb-2">
              <span className="flex items-center gap-1.5 text-[#00f5ff] font-bold">
                <Lock className="w-3.5 h-3.5 text-[#00f5ff]" />
                ARQUIVO CONFIDENCIAL
              </span>
              <span className="text-[#a5f3fc]">#{currentFigure.id.toUpperCase().slice(0, 6)}</span>
            </div>

            {/* Silhouette / Secret Portrait Box */}
            <div className="relative w-36 h-36 rounded-2xl bg-gradient-to-b from-[#1c0830] to-[#250c3d] border-2 border-dashed border-[#00f5ff]/40 flex items-center justify-center my-2 shadow-inner group">
              {isWon ? (
                <div className="flex flex-col items-center justify-center p-2 animate-in zoom-in-75 duration-300">
                  <div className="text-4xl mb-1">{currentFigure.badge.split(' ')[0]}</div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">
                    REVELADO!
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-600">
                  <HelpCircle className="w-16 h-16 text-[#00f5ff]/50 animate-pulse" />
                  <span className="text-[10px] font-mono text-[#a5f3fc] mt-1 uppercase tracking-wider">
                    Identidade Oculta
                  </span>
                </div>
              )}
            </div>

            {/* Mystery Identity Status */}
            <div className="mt-2 w-full">
              <h3 className="text-lg font-bold font-mono text-[#00f5ff] neon-text-glow">
                {isWon ? currentFigure.name : '??? ??? ???'}
              </h3>
              <p className="text-xs text-[#a5f3fc] font-mono mt-0.5">
                {isWon ? currentFigure.field : `Categoria: ${currentFigure.category}`}
              </p>
            </div>

            {/* Guess Button CTA */}
            <button
              onClick={() => setShowGuessModal(true)}
              disabled={isWon}
              className={`w-full mt-4 py-2.5 px-4 rounded-xl font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                isWon
                  ? 'bg-[#3b1761] text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#00f5ff] to-[#0284c7] hover:from-[#38e1ff] hover:to-[#00f5ff] text-[#1b0730] shadow-[#00f5ff]/25 active:scale-95'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              🎯 ARRISCAR QUEM É!
            </button>
          </div>

          {/* Progressive Clues & Dossier File */}
          <div className="bg-[#2a1144] border border-[#7e3bbd]/70 rounded-2xl p-4 shadow-xl flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#00f5ff] font-bold flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-[#00f5ff]" />
                PISTAS HISTÓRICAS ({revealedHints.length}/3)
              </span>
              <span className="text-[10px] text-slate-500">-75 pts cada</span>
            </div>

            <div className="flex flex-col gap-2 mt-1">
              {currentFigure.hints.map((hint, idx) => {
                const isUnlocked = revealedHints.includes(idx) || isWon;
                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border text-xs transition-all ${
                      isUnlocked
                        ? 'bg-slate-950/80 border-amber-500/30 text-slate-200'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-500 flex items-center justify-between'
                    }`}
                  >
                    {isUnlocked ? (
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-amber-400 font-bold text-[10px] mt-0.5">
                          #{idx + 1}
                        </span>
                        <p className="leading-relaxed text-[11px]">{hint}</p>
                      </div>
                    ) : (
                      <>
                        <span className="font-mono text-[11px] flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-slate-600" />
                          Pista #{idx + 1} Confidencial
                        </span>
                        <button
                          onClick={() => unlockHint(idx)}
                          className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-mono font-bold transition-colors"
                        >
                          Desbloquear
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Middle & Right Column: Question History & Interactive Oracle */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* Chat / Question History Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col h-[420px]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs font-mono">
              <span className="text-slate-300 font-bold flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-amber-400" />
                RELATÓRIO DE PERGUNTAS & DEDUÇÕES
              </span>
              <span className="text-[11px] text-slate-400">
                {history.length === 0 ? 'Nenhuma pergunta ainda' : `${history.length} registradas`}
              </span>
            </div>

            {/* Scrollable Questions List */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <Compass className="w-12 h-12 text-slate-700 mb-2 animate-spin-slow" />
                  <p className="text-sm font-medium text-slate-400">
                    O oráculo aguarda sua primeira pergunta.
                  </p>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm">
                    Pergunte sobre época, gênero, nacionalidade, grandes feitos ou profissão. O oráculo responderá estritamente com Sim ou Não!
                  </p>
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3 flex flex-col gap-1.5 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-300 font-mono">
                          P: {item.question}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-black font-mono px-2.5 py-0.5 rounded-full border shadow-sm ${getVerdictStyle(
                          item.verdict
                        )}`}
                      >
                        {item.verdict}
                      </span>
                    </div>
                    {item.detail && (
                      <p className="text-[11px] text-slate-400 pl-4 border-l-2 border-slate-800 italic">
                        {item.detail}
                      </p>
                    )}
                  </div>
                ))
              )}

              {isLoading && (
                <div className="bg-slate-950/70 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2 text-xs font-mono text-amber-400 animate-pulse">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  Consultando os registros históricos...
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Quick Questions Chips */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-1.5">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Perguntas Rápidas Sugeridas (Toque para perguntar):
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {QUICK_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => askQuestion(q)}
                  disabled={isLoading || isWon}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-300 text-[11px] transition-colors border border-slate-700/60 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Question Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              askQuestion(questionInput);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder="Faça sua pergunta de Sim/Não (ex: Ganhou um Nobel? Viveu no século XX?)"
                disabled={isLoading || isWon}
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none transition-all disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || isWon || !questionInput.trim()}
              className="bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold px-5 py-3 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-amber-500/20"
              title="Enviar pergunta"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Guess Modal Dialog */}
      {showGuessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-5 shadow-2xl relative">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold font-mono text-sm">
                <UserCheck className="w-5 h-5" />
                DAR PALPITE DE IDENTIDADE
              </div>
              <button
                onClick={() => setShowGuessModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕ Fechar
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-3">
              Quem você acha que é essa figura histórica? Se errar o palpite você perde 100 pontos, mas o jogo continua!
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                askQuestion(guessInput, true);
              }}
              className="flex flex-col gap-3"
            >
              <input
                type="text"
                autoFocus
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                placeholder="Ex: Albert Einstein, Frida Kahlo, Joana d'Arc..."
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none font-mono"
              />

              {/* Suggestions Chips */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono text-slate-400">Sugestões rápidas:</span>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {HISTORICAL_FIGURES.slice(0, 10).map((fig) => (
                    <button
                      key={fig.id}
                      type="button"
                      onClick={() => setGuessInput(fig.name)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-mono transition-colors"
                    >
                      {fig.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGuessModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!guessInput.trim() || isLoading}
                  className="px-5 py-2 rounded-xl text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition-colors disabled:opacity-50"
                >
                  Confirmar Palpite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Victory Full Banner */}
      {isWon && (
        <div className="w-full mt-6 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 border-2 border-emerald-500/60 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
            <div className="w-32 h-32 rounded-2xl bg-gradient-to-tr from-emerald-600 to-amber-500 p-1 shadow-2xl flex items-center justify-center text-5xl">
              <div className="w-full h-full bg-slate-950 rounded-xl flex flex-col items-center justify-center p-2">
                <span>{currentFigure.badge.split(' ')[0]}</span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase mt-1">
                  MESTRE
                </span>
              </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ENIGMA DESVENDADO!
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300">
                  {currentFigure.era}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300">
                  {currentFigure.nationality}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white font-mono">
                {currentFigure.name}
              </h2>
              <p className="text-xs font-mono text-amber-400 font-semibold mb-3">
                {currentFigure.field}
              </p>

              <blockquote className="text-xs sm:text-sm text-slate-300 italic mb-3 pl-3 border-l-2 border-emerald-500">
                &ldquo;{currentFigure.famousQuote}&rdquo;
              </blockquote>

              <p className="text-xs text-slate-400 leading-relaxed max-w-2xl mb-4">
                {currentFigure.bio}
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                <div className="text-xs font-mono text-slate-300">
                  Perguntas feitas:{' '}
                  <span className="text-amber-400 font-bold">{history.length}</span>
                </div>
                <div className="text-xs font-mono text-slate-300">
                  Pontos Conquistados:{' '}
                  <span className="text-emerald-400 font-bold">{score}</span>
                </div>

                <button
                  onClick={() => initRound()}
                  className="px-6 py-2.5 rounded-xl font-bold font-mono text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  JOGAR PRÓXIMA RODADA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
