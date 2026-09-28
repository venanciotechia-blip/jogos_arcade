'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Trophy, Award, Zap, Shield, ArrowLeft, ArrowRight, ArrowDown } from 'lucide-react';
import { sound } from '@/lib/sound';
import { getHighScore, saveHighScore } from '@/lib/gameStore';
import { awardAuraWin, triggerDefeat } from '@/lib/auraStore';

export interface OpponentConfig {
  id: string;
  name: string;
  nickname: string;
  origin: string;
  avatar: string;
  maxHp: number;
  speed: number; // attack frequency
  telegraphTime: number; // ms to react
  damage: number;
  color: string;
  gloveColor: string;
  hairColor: string;
  skinColor: string;
  taunt: string;
}

const OPPONENTS: OpponentConfig[] = [
  {
    id: 'kid_chapa',
    name: 'Kid Chapa',
    nickname: 'O Novato Sorridente',
    origin: 'Paris, França',
    avatar: '🥖',
    maxHp: 80,
    speed: 1800,
    telegraphTime: 620,
    damage: 14,
    color: '#38bdf8',
    gloveColor: '#0284c7',
    hairColor: '#f59e0b',
    skinColor: '#fcd34d',
    taunt: 'Yay! Cuidado com o meu direto!',
  },
  {
    id: 'toro_veloz',
    name: 'Toro Veloz',
    nickname: 'O Furacão do Caribe',
    origin: 'Havana, Cuba',
    avatar: '🌪️',
    maxHp: 120,
    speed: 1350,
    telegraphTime: 460,
    damage: 18,
    color: '#eab308',
    gloveColor: '#ca8a04',
    hairColor: '#1e293b',
    skinColor: '#d97706',
    taunt: 'Você não consegue acompanhar meu ritmo!',
  },
  {
    id: 'grande_bruiser',
    name: 'Grande Bruiser',
    nickname: 'O Lenhador Gigante',
    origin: 'Yukon, Canadá',
    avatar: '🐻',
    maxHp: 160,
    speed: 1400,
    telegraphTime: 520,
    damage: 26,
    color: '#ef4444',
    gloveColor: '#dc2626',
    hairColor: '#78350f',
    skinColor: '#fed7aa',
    taunt: 'Abraço de urso! Ninguém passa da minha pança!',
  },
  {
    id: 'campeao_galactico',
    name: 'Super Campeão',
    nickname: 'O Rei do Nocaute',
    origin: 'Las Vegas, EUA',
    avatar: '👑',
    maxHp: 200,
    speed: 1100,
    telegraphTime: 360,
    damage: 30,
    color: '#a855f7',
    gloveColor: '#9333ea',
    hairColor: '#fbbf24',
    skinColor: '#fbcfe8',
    taunt: 'Sinta o gosto da lona, garoto!',
  },
];

type PlayerAction =
  | 'IDLE'
  | 'JAB_LEFT'
  | 'JAB_RIGHT'
  | 'BODY_LEFT'
  | 'BODY_RIGHT'
  | 'DODGE_LEFT'
  | 'DODGE_RIGHT'
  | 'DUCK'
  | 'BLOCK'
  | 'SUPER_UPPERCUT'
  | 'HIT'
  | 'DOWN';

type OpponentAction =
  | 'IDLE'
  | 'TELEGRAPH_LEFT'
  | 'TELEGRAPH_RIGHT'
  | 'TELEGRAPH_HEAVY'
  | 'PUNCH_LEFT'
  | 'PUNCH_RIGHT'
  | 'PUNCH_HEAVY'
  | 'HIT_HEAD'
  | 'HIT_BODY'
  | 'STUNNED'
  | 'DOWN';

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 440;

export function PunchOutGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Match State
  const [gameState, setGameState] = useState<'IDLE' | 'FIGHTING' | 'COUNTDOWN' | 'ROUND_OVER' | 'VICTORY' | 'GAMEOVER'>('IDLE');
  const [opponentIdx, setOpponentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => getHighScore('punch_out'));
  const [roundTime, setRoundTime] = useState(180); // 3 minutes countdown
  const [playerHp, setPlayerHp] = useState(100);
  const [opponentHp, setOpponentHp] = useState(80);
  const [superMeter, setSuperMeter] = useState(0); // 0 to 100
  const [playerKnockdowns, setPlayerKnockdowns] = useState(0);
  const [opponentKnockdowns, setOpponentKnockdowns] = useState(0);
  const [refereeCount, setRefereeCount] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('Super Punch-Out!! Arcade');

  // Animation & Gameplay Loop references
  const animFrameRef = useRef<number | null>(null);
  const playerActionRef = useRef<PlayerAction>('IDLE');
  const playerActionTimerRef = useRef(0);
  const opponentActionRef = useRef<OpponentAction>('IDLE');
  const opponentActionTimerRef = useRef(0);
  const opponentNextAttackTimeRef = useRef(0);
  const refereeCountRef = useRef<number | null>(null);
  const screenShakeRef = useRef(0);
  const flashBulbsRef = useRef<{ x: number; y: number; alpha: number }[]>([]);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; color: string; alpha: number }[]>([]);
  const getUpTapsRef = useRef(0);

  useEffect(() => {
    refereeCountRef.current = refereeCount;
  }, [refereeCount]);

  const curOpponent = OPPONENTS[opponentIdx] || OPPONENTS[0];

  // Spawn Flashbulbs in crowd
  const spawnCrowdFlash = () => {
    if (Math.random() < 0.25) {
      flashBulbsRef.current.push({
        x: 30 + Math.random() * (CANVAS_WIDTH - 60),
        y: 20 + Math.random() * 80,
        alpha: 1,
      });
    }
  };

  // Start / Reset Bout
  const startBout = useCallback((oppIndex = 0) => {
    const opp = OPPONENTS[oppIndex] || OPPONENTS[0];
    setOpponentIdx(oppIndex);
    setOpponentHp(opp.maxHp);
    setPlayerHp(100);
    setSuperMeter(0);
    setRoundTime(180);
    setPlayerKnockdowns(0);
    setOpponentKnockdowns(0);
    setRefereeCount(null);
    setGameState('FIGHTING');
    playerActionRef.current = 'IDLE';
    playerActionTimerRef.current = 0;
    opponentActionRef.current = 'IDLE';
    opponentActionTimerRef.current = 0;
    opponentNextAttackTimeRef.current = Date.now() + 1200;
    screenShakeRef.current = 0;
    setAnnouncement(`ROUND 1 - LUTE!`);
    sound.playBoxingBell();
  }, []);

  // Opponent Knockdown
  const triggerOpponentKnockdown = useCallback(() => {
    sound.playPunchHeavy();
    opponentActionRef.current = 'DOWN';
    opponentActionTimerRef.current = 9999;
    setGameState('COUNTDOWN');
    setAnnouncement('O ADVERSÁRIO CAIU NA LONA!');

    setOpponentKnockdowns((kds) => {
      const nextKds = kds + 1;
      if (nextKds >= 3) {
        // TKO Win!
        setTimeout(() => {
          sound.playBoxingBell();
          setGameState('VICTORY');
          setAnnouncement(`VITÓRIA POR T.K.O. CONTRA ${curOpponent.name}!`);
          awardAuraWin('Super Punch-Out');
        }, 1500);
      } else {
        // Referee 10 Count
        let count = 1;
        setRefereeCount(count);
        sound.playCoin();

        const countInterval = setInterval(() => {
          count++;
          setRefereeCount(count);
          sound.playCoin();

          // Opponent gets up at 7 or 8 on 1st/2nd knockdown
          if (count === 7) {
            clearInterval(countInterval);
            setRefereeCount(null);
            opponentActionRef.current = 'IDLE';
            opponentActionTimerRef.current = 0;
            opponentNextAttackTimeRef.current = Date.now() + 1000;
            setOpponentHp(Math.round(curOpponent.maxHp * 0.45));
            setGameState('FIGHTING');
            setAnnouncement('O oponente levantou! LUTE!');
          }
        }, 800);
      }
      return nextKds;
    });
  }, [curOpponent]);

  // Player Actions
  const handlePlayerPunch = useCallback((type: 'JAB_LEFT' | 'JAB_RIGHT' | 'BODY_LEFT' | 'BODY_RIGHT') => {
    if (gameState !== 'FIGHTING') return;
    if (playerActionRef.current !== 'IDLE' && playerActionRef.current !== 'BLOCK') return;

    playerActionRef.current = type;
    playerActionTimerRef.current = 10; // ~160ms animation

    const oppAction = opponentActionRef.current;
    const isTelegraphing = oppAction.startsWith('TELEGRAPH');
    const isStunned = oppAction === 'STUNNED';
    const isBodyShot = type.startsWith('BODY');

    // Bear Hugger blocks body shots
    if (curOpponent.id === 'grande_bruiser' && isBodyShot && !isStunned) {
      sound.playCushion();
      setAnnouncement('Bloqueado pela pança!');
      return;
    }

    if (oppAction === 'IDLE' || isTelegraphing || isStunned) {
      // Punch Connects!
      const isCounter = isTelegraphing;
      const baseDamage = isCounter ? 16 : isBodyShot ? 9 : 8;
      sound.playPunchJab();

      if (isCounter) {
        sound.playPunchHeavy();
        screenShakeRef.current = 8;
        setAnnouncement('★ GOLPE DE ENCONTRO (COUNTER)! ★');
        setScore((s) => {
          const next = s + 1500;
          saveHighScore('punch_out', next);
          setHighScore((h) => Math.max(h, next));
          return next;
        });
      } else {
        setScore((s) => {
          const next = s + 300;
          saveHighScore('punch_out', next);
          setHighScore((h) => Math.max(h, next));
          return next;
        });
      }

      // Spark particles
      for (let i = 0; i < (isCounter ? 12 : 6); i++) {
        particlesRef.current.push({
          x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 40,
          y: isBodyShot ? 220 : 160,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          color: isCounter ? '#facc15' : '#f8fafc',
          alpha: 1,
        });
      }

      // Build Super Meter
      setSuperMeter((sm) => Math.min(100, sm + (isCounter ? 25 : 12)));

      // Opponent recoil state
      opponentActionRef.current = isCounter ? 'STUNNED' : isBodyShot ? 'HIT_BODY' : 'HIT_HEAD';
      opponentActionTimerRef.current = isCounter ? 35 : 12;

      setOpponentHp((prev) => {
        const next = Math.max(0, prev - baseDamage);
        if (next <= 0) {
          // Opponent Knockdown!
          triggerOpponentKnockdown();
        }
        return next;
      });
    } else {
      // Opponent is punching or invincible -> Whiff
      sound.playPunchJab();
    }
  }, [gameState, curOpponent.id, triggerOpponentKnockdown]);

  // Player Super Uppercut
  const handleSuperUppercut = useCallback(() => {
    if (gameState !== 'FIGHTING' || superMeter < 100) return;
    if (playerActionRef.current !== 'IDLE' && playerActionRef.current !== 'BLOCK') return;

    playerActionRef.current = 'SUPER_UPPERCUT';
    playerActionTimerRef.current = 24;
    setSuperMeter(0);
    sound.playSuperUppercut();
    screenShakeRef.current = 15;
    setAnnouncement('💥 SUPER NOCAUTE!! 💥');

    // Massive sparks
    for (let i = 0; i < 20; i++) {
      particlesRef.current.push({
        x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 50,
        y: 160 + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        color: '#f59e0b',
        alpha: 1,
      });
    }

    setScore((s) => {
      const next = s + 5000;
      saveHighScore('punch_out', next);
      setHighScore((h) => Math.max(h, next));
      return next;
    });

    opponentActionRef.current = 'STUNNED';
    opponentActionTimerRef.current = 45;

    setOpponentHp((prev) => {
      const next = Math.max(0, prev - 45);
      if (next <= 0) {
        triggerOpponentKnockdown();
      }
      return next;
    });
  }, [gameState, superMeter, triggerOpponentKnockdown]);

  // Player Defensive Moves
  const handleDodge = useCallback((dir: 'DODGE_LEFT' | 'DODGE_RIGHT' | 'DUCK') => {
    if (gameState !== 'FIGHTING') return;
    if (playerActionRef.current !== 'IDLE' && playerActionRef.current !== 'BLOCK') return;

    playerActionRef.current = dir;
    playerActionTimerRef.current = 14;
    sound.playDodge();
  }, [gameState]);

  const handleBlock = useCallback((isBlocking: boolean) => {
    if (gameState !== 'FIGHTING') return;
    if (isBlocking) {
      if (playerActionRef.current === 'IDLE') {
        playerActionRef.current = 'BLOCK';
      }
    } else {
      if (playerActionRef.current === 'BLOCK') {
        playerActionRef.current = 'IDLE';
      }
    }
  }, [gameState]);

  // Player Knockdown
  const triggerPlayerKnockdown = useCallback(() => {
    sound.playPunchHeavy();
    playerActionRef.current = 'DOWN';
    playerActionTimerRef.current = 9999;
    setGameState('COUNTDOWN');
    getUpTapsRef.current = 0;
    setAnnouncement('VOCÊ CAIU! APERTE OS BOTÕES PARA LEVANTAR!');

    setPlayerKnockdowns((kds) => {
      const nextKds = kds + 1;
      if (nextKds >= 3) {
        setTimeout(() => {
          sound.playBoxingBell();
          sound.playGameOver();
          setGameState('GAMEOVER');
          setAnnouncement('DERROTA POR T.K.O.!');
          triggerDefeat('Super Punch-Out');
        }, 1500);
      } else {
        let count = 1;
        setRefereeCount(count);
        sound.playCoin();

        const countInterval = setInterval(() => {
          count++;
          setRefereeCount(count);
          sound.playCoin();

          if (getUpTapsRef.current >= 8) {
            // Player successfully got up!
            clearInterval(countInterval);
            setRefereeCount(null);
            playerActionRef.current = 'IDLE';
            playerActionTimerRef.current = 0;
            setPlayerHp(40);
            setGameState('FIGHTING');
            setAnnouncement('Você levantou! CONTINUE LUTANDO!');
          } else if (count >= 10) {
            // Knockout Loss!
            clearInterval(countInterval);
            sound.playBoxingBell();
            sound.playGameOver();
            setGameState('GAMEOVER');
            setAnnouncement('NOCAUTE (K.O.)! FIM DE LUTA!');
            triggerDefeat('Super Punch-Out');
          }
        }, 850);
      }
      return nextKds;
    });
  }, []);

  // Tap button to get up from knockdown
  const handleGetUpTap = useCallback(() => {
    if (gameState === 'COUNTDOWN' && playerActionRef.current === 'DOWN') {
      getUpTapsRef.current += 1;
      sound.playClick();
      setPlayerHp((h) => Math.min(100, h + 5));
    }
  }, [gameState]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'z', 'Z', 'x', 'X', 'a', 'A', 's', 'S', 'd', 'D', 'w', 'W'].includes(e.key)) {
        e.preventDefault();
      }

      handleGetUpTap();

      if (e.key === ' ' && superMeter >= 100) {
        handleSuperUppercut();
      } else if (e.key === 'ArrowLeft' || e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey || e.ctrlKey || e.altKey) {
          handlePlayerPunch('BODY_LEFT');
        } else {
          handlePlayerPunch('JAB_LEFT');
        }
      } else if (e.key === 'ArrowRight' || e.key === 'x' || e.key === 'X') {
        if (e.shiftKey || e.ctrlKey || e.altKey) {
          handlePlayerPunch('BODY_RIGHT');
        } else {
          handlePlayerPunch('JAB_RIGHT');
        }
      } else if (e.key === 'ArrowDown') {
        handleDodge('DUCK');
      } else if (e.key === 'a' || e.key === 'A') {
        handleDodge('DODGE_LEFT');
      } else if (e.key === 'd' || e.key === 'D') {
        handleDodge('DODGE_RIGHT');
      } else if (e.key === 's' || e.key === 'S') {
        handleDodge('DUCK');
      } else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        handleBlock(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        handleBlock(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handlePlayerPunch, handleSuperUppercut, handleDodge, handleBlock, handleGetUpTap, superMeter, gameState]);

  // Main 60 FPS Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      if (gameState === 'FIGHTING') {
        updateCombat();
      }
      render(ctx);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    const updateCombat = () => {
      spawnCrowdFlash();

      // Screen shake decay
      if (screenShakeRef.current > 0) {
        screenShakeRef.current = Math.max(0, screenShakeRef.current - 1);
      }

      // 1. Player Action Timer
      if (playerActionTimerRef.current > 0) {
        playerActionTimerRef.current--;
        if (playerActionTimerRef.current <= 0 && playerActionRef.current !== 'BLOCK' && playerActionRef.current !== 'DOWN') {
          playerActionRef.current = 'IDLE';
        }
      }

      // 2. Opponent Action Timer & Logic
      if (opponentActionTimerRef.current > 0) {
        opponentActionTimerRef.current--;
        if (opponentActionTimerRef.current <= 0 && opponentActionRef.current !== 'DOWN') {
          // If was telegraphing -> Unleash the punch!
          if (opponentActionRef.current === 'TELEGRAPH_LEFT') {
            opponentActionRef.current = 'PUNCH_LEFT';
            opponentActionTimerRef.current = 10;
            checkOpponentPunchHit('LEFT');
          } else if (opponentActionRef.current === 'TELEGRAPH_RIGHT') {
            opponentActionRef.current = 'PUNCH_RIGHT';
            opponentActionTimerRef.current = 10;
            checkOpponentPunchHit('RIGHT');
          } else if (opponentActionRef.current === 'TELEGRAPH_HEAVY') {
            opponentActionRef.current = 'PUNCH_HEAVY';
            opponentActionTimerRef.current = 14;
            checkOpponentPunchHit('HEAVY');
          } else {
            opponentActionRef.current = 'IDLE';
            opponentNextAttackTimeRef.current = Date.now() + curOpponent.speed * (0.8 + Math.random() * 0.4);
          }
        }
      }

      // 3. Opponent AI: Initiate Attacks
      if (opponentActionRef.current === 'IDLE' && Date.now() > opponentNextAttackTimeRef.current) {
        const rand = Math.random();
        if (rand < 0.4) {
          opponentActionRef.current = 'TELEGRAPH_LEFT';
          opponentActionTimerRef.current = Math.round(curOpponent.telegraphTime / 16.6);
        } else if (rand < 0.8) {
          opponentActionRef.current = 'TELEGRAPH_RIGHT';
          opponentActionTimerRef.current = Math.round(curOpponent.telegraphTime / 16.6);
        } else {
          opponentActionRef.current = 'TELEGRAPH_HEAVY';
          opponentActionTimerRef.current = Math.round((curOpponent.telegraphTime * 1.25) / 16.6);
        }
      }

      // 4. Decay Flashbulbs & Particles
      flashBulbsRef.current = flashBulbsRef.current
        .map((f) => ({ ...f, alpha: f.alpha - 0.15 }))
        .filter((f) => f.alpha > 0);

      particlesRef.current = particlesRef.current
        .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, alpha: p.alpha - 0.04 }))
        .filter((p) => p.alpha > 0);
    };

    // Check if Opponent's Punch hits Little Mac
    const checkOpponentPunchHit = (punchType: 'LEFT' | 'RIGHT' | 'HEAVY') => {
      const pAct = playerActionRef.current;
      let dodged = false;

      if (punchType === 'LEFT' && pAct === 'DODGE_LEFT') dodged = true;
      if (punchType === 'RIGHT' && pAct === 'DODGE_RIGHT') dodged = true;
      if (punchType === 'HEAVY' && pAct === 'DUCK') dodged = true;

      if (dodged) {
        sound.playDodge();
        setAnnouncement('ESQUIVA PERFEITA!');
        setScore((s) => {
          const next = s + 500;
          saveHighScore('punch_out', next);
          setHighScore((h) => Math.max(h, next));
          return next;
        });
        return;
      }

      // Check if blocked
      if (pAct === 'BLOCK' && punchType !== 'HEAVY') {
        sound.playPunchJab();
        setPlayerHp((h) => Math.max(0, h - 3)); // Minimal chip damage
        setAnnouncement('GOLPE BLOQUEADO!');
        return;
      }

      // Direct Hit!
      sound.playPunchHeavy();
      screenShakeRef.current = 10;
      playerActionRef.current = 'HIT';
      playerActionTimerRef.current = 15;
      setSuperMeter(0); // Lose super meter on hit!

      const dmg = punchType === 'HEAVY' ? curOpponent.damage * 1.5 : curOpponent.damage;
      setPlayerHp((h) => {
        const next = Math.max(0, h - dmg);
        if (next <= 0) {
          triggerPlayerKnockdown();
        }
        return next;
      });
    };

    // Render 2D Arcade Boxing Ring & Characters
    const render = (c: CanvasRenderingContext2D) => {
      c.save();

      // Screen Shake
      if (screenShakeRef.current > 0) {
        const sx = (Math.random() - 0.5) * screenShakeRef.current * 1.5;
        const sy = (Math.random() - 0.5) * screenShakeRef.current * 1.5;
        c.translate(sx, sy);
      }

      // 1. Arena Crowd Background
      const crowdGrad = c.createLinearGradient(0, 0, 0, 140);
      crowdGrad.addColorStop(0, '#020617');
      crowdGrad.addColorStop(1, '#0f172a');
      c.fillStyle = crowdGrad;
      c.fillRect(0, 0, CANVAS_WIDTH, 140);

      // Silhouettes of spectators
      c.fillStyle = '#1e293b';
      for (let x = 10; x < CANVAS_WIDTH; x += 18) {
        c.beginPath();
        c.arc(x, 100 + Math.sin(x) * 4, 7, 0, Math.PI * 2);
        c.fill();
        c.fillRect(x - 6, 106, 12, 16);
      }

      // Camera Flashbulbs in crowd
      flashBulbsRef.current.forEach((f) => {
        c.save();
        c.fillStyle = `rgba(255, 255, 255, ${f.alpha})`;
        c.shadowColor = '#ffffff';
        c.shadowBlur = 12;
        c.beginPath();
        c.arc(f.x, f.y, 6, 0, Math.PI * 2);
        c.fill();
        c.restore();
      });

      // 2. Ring Canvas Mat
      const matGrad = c.createLinearGradient(0, 120, 0, CANVAS_HEIGHT);
      matGrad.addColorStop(0, '#047857');
      matGrad.addColorStop(0.5, '#065f46');
      matGrad.addColorStop(1, '#064e3b');
      c.fillStyle = matGrad;
      c.fillRect(0, 120, CANVAS_WIDTH, CANVAS_HEIGHT - 120);

      // Arena Light Spotlight Cone
      const spotGrad = c.createRadialGradient(
        CANVAS_WIDTH / 2,
        240,
        30,
        CANVAS_WIDTH / 2,
        240,
        220
      );
      spotGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      spotGrad.addColorStop(1, 'transparent');
      c.fillStyle = spotGrad;
      c.fillRect(0, 120, CANVAS_WIDTH, CANVAS_HEIGHT - 120);

      // Ring Ropes (Red, White, Blue)
      const drawRope = (y: number, col: string) => {
        c.strokeStyle = col;
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(CANVAS_WIDTH, y);
        c.stroke();
      };
      drawRope(115, '#ef4444');
      drawRope(132, '#f8fafc');
      drawRope(149, '#3b82f6');

      // 3. Render Opponent
      renderOpponent(c);

      // 4. Render Protagonist Little Mac (Semi-transparent wireframe/green athletic mesh)
      renderLittleMac(c);

      // 5. Render Particle Sparks
      particlesRef.current.forEach((p) => {
        c.save();
        c.globalAlpha = p.alpha;
        c.fillStyle = p.color;
        c.shadowColor = p.color;
        c.shadowBlur = 6;
        c.beginPath();
        c.arc(p.x, p.y, 3, 0, Math.PI * 2);
        c.fill();
        c.restore();
      });

      // 6. Referee Countdown Overlay
      if (refereeCountRef.current !== null) {
        c.save();
        c.font = 'black 54px monospace';
        c.fillStyle = '#facc15';
        c.strokeStyle = '#000000';
        c.lineWidth = 6;
        c.textAlign = 'center';
        c.strokeText(`${refereeCountRef.current}!`, CANVAS_WIDTH / 2, 210);
        c.fillText(`${refereeCountRef.current}!`, CANVAS_WIDTH / 2, 210);
        c.restore();
      }

      c.restore();
    };

    // Render Opponent Boxer
    const renderOpponent = (c: CanvasRenderingContext2D) => {
      const opp = curOpponent;
      const act = opponentActionRef.current;
      const isDown = act === 'DOWN';
      const isStunned = act === 'STUNNED';
      const isTelegraphing = act.startsWith('TELEGRAPH');
      const isPunching = act.startsWith('PUNCH');

      c.save();
      const oppX = CANVAS_WIDTH / 2;
      const oppY = isDown ? 290 : 190;

      c.translate(oppX, oppY);

      if (isDown) {
        // Knocked down on canvas mat
        c.rotate(-0.3);
        c.fillStyle = opp.skinColor;
        c.fillRect(-45, -20, 90, 40);
        c.fillStyle = opp.color;
        c.fillRect(-40, 20, 80, 25);
        c.font = '24px sans-serif';
        c.fillText('😵', -15, -25);
        c.restore();
        return;
      }

      // Telegraph Glow Flashing
      if (isTelegraphing) {
        c.shadowColor = '#ef4444';
        c.shadowBlur = 20;
      }

      // Torso / Boxing Trunks
      c.fillStyle = opp.skinColor;
      c.beginPath();
      c.roundRect(-42, -50, 84, 85, 12);
      c.fill();

      // Trunks
      c.fillStyle = opp.color;
      c.fillRect(-40, 30, 80, 35);
      c.fillStyle = '#ffffff';
      c.fillRect(-40, 30, 80, 6); // Trunks belt

      // Head
      c.fillStyle = opp.skinColor;
      c.beginPath();
      c.arc(0, -78, 28, 0, Math.PI * 2);
      c.fill();

      // Hair
      c.fillStyle = opp.hairColor;
      c.beginPath();
      c.arc(0, -90, 26, Math.PI, 0, false);
      c.fill();

      // Facial Features
      c.fillStyle = '#0f172a';
      if (isStunned) {
        // Dizzy spiral eyes
        c.font = 'bold 16px monospace';
        c.textAlign = 'center';
        c.fillText('@ @', 0, -75);
        c.fillText('~', 0, -62);
      } else if (isTelegraphing) {
        // Fierce red grimace
        c.fillStyle = '#ef4444';
        c.beginPath();
        c.arc(-8, -78, 5, 0, Math.PI * 2);
        c.arc(8, -78, 5, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#ffffff';
        c.fillRect(-10, -68, 20, 6);
      } else {
        // Normal tough eyes
        c.fillRect(-12, -81, 7, 4);
        c.fillRect(5, -81, 7, 4);
        // Grin
        c.fillRect(-8, -67, 16, 4);
      }

      // Boxing Gloves
      c.fillStyle = isTelegraphing ? '#ef4444' : opp.gloveColor;
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2;

      if (act === 'PUNCH_LEFT') {
        // Left glove thrust forward toward player!
        c.beginPath();
        c.arc(-30, 20, 30, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      } else if (act === 'PUNCH_RIGHT') {
        // Right glove thrust forward!
        c.beginPath();
        c.arc(30, 20, 30, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      } else if (act === 'PUNCH_HEAVY') {
        // Both gloves overhead slam!
        c.beginPath();
        c.arc(0, 35, 36, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      } else {
        // Guard Stance
        const bob = Math.sin(Date.now() * 0.008) * 3;
        c.beginPath();
        c.arc(-32, -35 + bob, 18, 0, Math.PI * 2);
        c.arc(32, -35 + bob, 18, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }

      // Dizzy Stars around head when stunned
      if (isStunned) {
        const starAngle = (Date.now() * 0.006) % (Math.PI * 2);
        for (let i = 0; i < 3; i++) {
          const a = starAngle + (i * Math.PI * 2) / 3;
          const sx = Math.cos(a) * 38;
          const sy = -80 + Math.sin(a) * 12;
          c.fillStyle = '#facc15';
          c.font = '14px sans-serif';
          c.fillText('★', sx - 5, sy + 5);
        }
      }

      c.restore();
    };

    // Render Protagonist Little Mac (Behind the back, semi-transparent wireframe/mesh)
    const renderLittleMac = (c: CanvasRenderingContext2D) => {
      const act = playerActionRef.current;
      c.save();

      let macX = CANVAS_WIDTH / 2;
      let macY = 325;

      if (act === 'DODGE_LEFT') macX -= 45;
      if (act === 'DODGE_RIGHT') macX += 45;
      if (act === 'DUCK') macY += 35;
      if (act === 'SUPER_UPPERCUT') macY -= 30;

      c.translate(macX, macY);

      // Semi-transparent Green/Cyan Athletic Mesh (Super Punch-Out arcade style)
      c.fillStyle = 'rgba(16, 185, 129, 0.45)';
      c.strokeStyle = '#34d399';
      c.lineWidth = 2.5;

      // Back of Torso
      c.beginPath();
      c.roundRect(-28, -45, 56, 60, 8);
      c.fill();
      c.stroke();

      // Green Tank Top Outline
      c.fillStyle = 'rgba(5, 150, 105, 0.6)';
      c.fillRect(-22, -45, 44, 45);

      // Head (Back of black hair)
      c.fillStyle = '#0f172a';
      c.beginPath();
      c.arc(0, -62, 18, 0, Math.PI * 2);
      c.fill();

      // Gloves & Punch Animations
      c.fillStyle = '#ef4444'; // Red boxing gloves
      c.strokeStyle = '#f8fafc';
      c.lineWidth = 2;

      if (act === 'JAB_LEFT') {
        // Extended Left Glove punching forward
        c.beginPath();
        c.arc(-16, -100, 16, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        // Right glove in guard
        c.beginPath();
        c.arc(22, -35, 14, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      } else if (act === 'JAB_RIGHT') {
        // Extended Right Glove
        c.beginPath();
        c.arc(16, -100, 16, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        // Left glove in guard
        c.beginPath();
        c.arc(-22, -35, 14, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      } else if (act === 'BODY_LEFT') {
        c.beginPath();
        c.arc(-24, -65, 16, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      } else if (act === 'BODY_RIGHT') {
        c.beginPath();
        c.arc(24, -65, 16, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      } else if (act === 'SUPER_UPPERCUT') {
        // Glowing Golden Flaming Glove
        c.fillStyle = '#f59e0b';
        c.shadowColor = '#f59e0b';
        c.shadowBlur = 20;
        c.beginPath();
        c.arc(0, -115, 22, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      } else if (act === 'BLOCK') {
        // High Guard: Both gloves held high in front of face
        c.beginPath();
        c.arc(-10, -55, 15, 0, Math.PI * 2);
        c.arc(10, -55, 15, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      } else {
        // Idle Guard Stance
        const idleBob = Math.sin(Date.now() * 0.01) * 2;
        c.beginPath();
        c.arc(-22, -38 + idleBob, 14, 0, Math.PI * 2);
        c.arc(22, -38 - idleBob, 14, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }

      c.restore();
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState, curOpponent, triggerPlayerKnockdown]);

  // Round Timer Countdown
  useEffect(() => {
    if (gameState !== 'FIGHTING') return;

    const timer = setInterval(() => {
      setRoundTime((t) => {
        if (t <= 1) {
          clearInterval(timer);
          // Time Expired -> Decision
          sound.playBoxingBell();
          if (opponentHp < playerHp) {
            setGameState('VICTORY');
            setAnnouncement(`VITÓRIA POR PONTOS CONTRA ${curOpponent.name}!`);
          } else {
            setGameState('GAMEOVER');
            setAnnouncement('DERROTA POR DECISÃO DOS JUÍZES!');
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, opponentHp, playerHp, curOpponent.name]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto font-sans select-none">
      {/* ARCADE HUD: OPPONENT vs PLAYER */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-t-2xl p-3 flex flex-col gap-2 shadow-xl">
        {/* Opponent Info & HP */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{curOpponent.avatar}</span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-white text-xs sm:text-sm tracking-wide">
                  {curOpponent.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">({curOpponent.origin})</span>
              </div>
              <div className="text-[10px] text-amber-400 font-mono italic">
                &quot;{curOpponent.taunt}&quot;
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[9px] font-mono text-slate-400">PONTOS</span>
            <div className="text-xs sm:text-sm font-black text-emerald-400 font-mono">
              {score.toLocaleString('pt-BR')}
            </div>
          </div>
        </div>

        {/* Health Bars Row */}
        <div className="grid grid-cols-2 gap-3 items-center">
          {/* Opponent HP */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-red-400 font-bold">OPONENTE HP</span>
              <span className="text-white font-bold">{Math.round((opponentHp / curOpponent.maxHp) * 100)}%</span>
            </div>
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400 transition-all duration-150"
                style={{ width: `${(opponentHp / curOpponent.maxHp) * 100}%` }}
              />
            </div>
          </div>

          {/* Player HP */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-emerald-400 font-bold">LITTLE MAC HP</span>
              <span className="text-white font-bold">{playerHp}%</span>
            </div>
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-150"
                style={{ width: `${playerHp}%` }}
              />
            </div>
          </div>
        </div>

        {/* Round Timer & Super Meter */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">TEMPO:</span>
            <span className="font-black text-amber-400 text-sm tabular-nums">{formatTimer(roundTime)}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">KD: {opponentKnockdowns}/3</span>
          </div>

          {/* Glowing Super KO Bar */}
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold ${superMeter >= 100 ? 'text-amber-300 animate-pulse' : 'text-slate-400'}`}>
              SUPER KO:
            </span>
            <div className="w-24 h-2.5 bg-slate-950 rounded-full border border-slate-700 overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  superMeter >= 100
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-white animate-pulse'
                    : 'bg-cyan-500'
                }`}
                style={{ width: `${superMeter}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Boxing Ring Canvas */}
      <div className="relative w-full aspect-[480/440] max-h-[440px] bg-slate-950 border-x border-slate-800 overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full block"
          onClick={handleGetUpTap}
        />

        {/* Start Game Modal */}
        {gameState === 'IDLE' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3 shadow-lg shadow-red-500/20 text-3xl">
              🥊
            </div>
            <h3 className="text-2xl font-black text-white mb-1">Super Nocaute!! (Punch-Out)</h3>
            <p className="text-xs text-red-400 font-mono mb-4 uppercase tracking-widest">
              Circuito Mundial de Boxe Arcade
            </p>
            <p className="text-xs text-slate-300 max-w-sm mb-6 leading-relaxed">
              Esquive dos socos telegrafados, acerte socos de encontro (Counters), carregue a barra KO e mande os gigantes para a lona com o Super Uppercut!
            </p>
            <button
              onClick={() => startBout(0)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-black text-sm shadow-xl shadow-red-500/25 active:scale-95 transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Subir ao Ringue!
            </button>
          </div>
        )}

        {/* Victory Modal */}
        {gameState === 'VICTORY' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="text-4xl mb-2 animate-bounce">🏆 🥊 🥇</div>
            <div className="text-amber-400 font-mono text-xs tracking-widest font-bold mb-1">
              CAMPEÃO DO CIRCUITO!
            </div>
            <h3 className="text-2xl font-black text-white mb-2">{announcement}</h3>
            <p className="text-xs text-slate-300 mb-6 font-mono">
              Pontuação Final: <span className="text-emerald-400 font-bold">{score.toLocaleString('pt-BR')}</span>
            </p>
            <div className="flex gap-2">
              {opponentIdx < OPPONENTS.length - 1 ? (
                <button
                  onClick={() => startBout(opponentIdx + 1)}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Award className="w-4 h-4" />
                  Próximo Desafiante!
                </button>
              ) : (
                <button
                  onClick={() => startBout(0)}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  Defender Cinturão (Novo Jogo)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Game Over Modal */}
        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="text-red-500 font-mono text-xs tracking-widest font-bold mb-1">
              FIM DE LUTA
            </div>
            <h3 className="text-2xl font-black text-white mb-2">{announcement}</h3>
            <p className="text-xs text-slate-400 mb-6 font-mono">
              Pontuação Final: <span className="text-amber-400 font-bold">{score.toLocaleString('pt-BR')}</span>
            </p>
            <button
              onClick={() => startBout(opponentIdx)}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Tentar Novamente (Revanche)
            </button>
          </div>
        )}
      </div>

      {/* Modern Boxing Arcade Action Pad */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-b-2xl p-3 flex flex-col gap-2.5">
        {/* Dynamic Announcer Banner */}
        <div className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs font-mono text-cyan-300 font-bold truncate">
          {announcement}
        </div>

        {/* Action Controls Grid */}
        <div className="grid grid-cols-2 gap-3 w-full">
          {/* Defense Controls */}
          <div className="flex flex-col gap-1.5 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 text-center">ESQUIVAS E GUARDA</span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleDodge('DODGE_LEFT')}
                className="py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs text-slate-200 font-bold flex flex-col items-center justify-center"
                title="Esquivar para esquerda (A)"
              >
                <ArrowLeft className="w-4 h-4 text-cyan-400" />
                <span className="text-[9px]">ESQ (A)</span>
              </button>

              <button
                type="button"
                onClick={() => handleDodge('DUCK')}
                className="py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs text-slate-200 font-bold flex flex-col items-center justify-center"
                title="Agachar / Desviar por baixo (S / Baixo)"
              >
                <ArrowDown className="w-4 h-4 text-amber-400" />
                <span className="text-[9px]">ABAIXO (S)</span>
              </button>

              <button
                type="button"
                onClick={() => handleDodge('DODGE_RIGHT')}
                className="py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs text-slate-200 font-bold flex flex-col items-center justify-center"
                title="Esquivar para direita (D)"
              >
                <ArrowRight className="w-4 h-4 text-cyan-400" />
                <span className="text-[9px]">DIR (D)</span>
              </button>
            </div>

            <button
              type="button"
              onPointerDown={() => handleBlock(true)}
              onPointerUp={() => handleBlock(false)}
              onPointerLeave={() => handleBlock(false)}
              className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-[10px] text-slate-200 font-bold flex items-center justify-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span>SEGURE PARA BLOQUEAR (W)</span>
            </button>
          </div>

          {/* Offense Controls */}
          <div className="flex flex-col gap-1.5 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 text-center">GOLPES E SOCOS</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handlePlayerPunch('JAB_LEFT')}
                className="py-2.5 rounded-lg bg-gradient-to-b from-red-600 to-rose-700 hover:from-red-500 active:scale-95 text-white font-black text-xs flex flex-col items-center justify-center shadow"
              >
                <span>JAB ESQ.</span>
                <span className="text-[9px] opacity-75 font-mono">(Z)</span>
              </button>

              <button
                type="button"
                onClick={() => handlePlayerPunch('JAB_RIGHT')}
                className="py-2.5 rounded-lg bg-gradient-to-b from-red-600 to-rose-700 hover:from-red-500 active:scale-95 text-white font-black text-xs flex flex-col items-center justify-center shadow"
              >
                <span>DIRETO DIR.</span>
                <span className="text-[9px] opacity-75 font-mono">(X)</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handlePlayerPunch('BODY_LEFT')}
                className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-[10px]"
              >
                CORPO ESQ.
              </button>

              <button
                type="button"
                onClick={() => handlePlayerPunch('BODY_RIGHT')}
                className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-[10px]"
              >
                CORPO DIR.
              </button>
            </div>
          </div>
        </div>

        {/* Super Uppercut Big Button */}
        <button
          type="button"
          disabled={superMeter < 100 || gameState !== 'FIGHTING'}
          onClick={handleSuperUppercut}
          className={`w-full py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${
            superMeter >= 100
              ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-500 text-slate-950 shadow-amber-500/30 animate-pulse'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
          }`}
        >
          <Zap className="w-4 h-4 fill-current" />
          <span>{superMeter >= 100 ? '💥 DISPARAR SUPER NOCAUTE!! (ESPAÇO) 💥' : 'CARREGUE A BARRA DE SUPER KO'}</span>
        </button>

        {/* Footer info & Opponent Switcher */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800">
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Recorde: {highScore.toLocaleString('pt-BR')}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">Oponente:</span>
            <select
              value={opponentIdx}
              onChange={(e) => startBout(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-0.5 outline-none font-medium"
            >
              {OPPONENTS.map((opp, i) => (
                <option key={opp.id} value={i}>
                  {opp.avatar} {opp.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
