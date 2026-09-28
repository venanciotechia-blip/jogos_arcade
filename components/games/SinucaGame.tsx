'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Trophy, Users, Bot, User, ChevronLeft, ChevronRight, Zap, Target, Award } from 'lucide-react';
import { sound } from '@/lib/sound';
import { getHighScore, saveHighScore } from '@/lib/gameStore';
import { awardAuraWin } from '@/lib/auraStore';

export type GameMode = '2P' | 'VS_AI' | 'SOLO';
export type BallGroup = 'ANY' | 'SOLIDS' | 'STRIPES'; // 1-7 Lisas vs 9-15 Listradas

interface Ball {
  id: number;
  number: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isStriped: boolean;
  potted: boolean;
  scale: number;
}

interface Pocket {
  x: number;
  y: number;
  radius: number;
  type: 'corner' | 'side';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
}

// Table Dimensions
const TABLE_WIDTH = 680;
const TABLE_HEIGHT = 380;
const FELT_X = 42;
const FELT_Y = 42;
const FELT_WIDTH = 596;
const FELT_HEIGHT = 296;
const BALL_R = 9.5;
const FRICTION = 0.988;

const BALL_COLORS: Record<number, string> = {
  1: '#eab308', // Amarela
  2: '#2563eb', // Azul
  3: '#dc2626', // Vermelha
  4: '#9333ea', // Roxa
  5: '#ea580c', // Laranja
  6: '#16a34a', // Verde
  7: '#78350f', // Marrom
  8: '#111827', // Bola 8 Preta
  9: '#eab308', // Listrada Amarela
  10: '#2563eb', // Listrada Azul
  11: '#dc2626', // Listrada Vermelha
  12: '#9333ea', // Listrada Roxa
  13: '#ea580c', // Listrada Laranja
  14: '#16a34a', // Listrada Verde
  15: '#78350f', // Listrada Marrom
};

export function SinucaGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Match Configuration & State
  const [gameMode, setGameMode] = useState<GameMode>('2P');
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'GAMEOVER'>('IDLE');
  const [winner, setWinner] = useState<string | null>(null);
  const [winReason, setWinReason] = useState<string>('');

  // Players
  const [activePlayer, setActivePlayer] = useState<1 | 2>(1);
  const [p1Group, setP1Group] = useState<BallGroup>('ANY');
  const [p2Group, setP2Group] = useState<BallGroup>('ANY');
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [p1Wins, setP1Wins] = useState(0);
  const [p2Wins, setP2Wins] = useState(0);

  // Status & Controls
  const [highScore, setHighScore] = useState<number>(() => getHighScore('sinuca'));
  const [shotsCount, setShotsCount] = useState(0);
  const [pottedNumbers, setPottedNumbers] = useState<number[]>([]);
  const [statusMessage, setStatusMessage] = useState('Jogador 1: Dê a tacada de abertura para estourar o rack!');
  const [power, setPower] = useState(60);
  const [isChargingShot, setIsChargingShot] = useState(false);
  const [cueAngle, setCueAngle] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Engine Refs
  const ballsRef = useRef<Ball[]>([]);
  const cueBallRef = useRef<Ball | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const isMovingRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);
  const isDraggingCueRef = useRef(false);

  // Shot tracking refs for turn arbitration
  const shotPottedBallsRef = useRef<number[]>([]);
  const cuePottedThisShotRef = useRef(false);
  const eightPottedThisShotRef = useRef(false);
  const activePlayerRef = useRef<1 | 2>(1);
  const p1GroupRef = useRef<BallGroup>('ANY');
  const p2GroupRef = useRef<BallGroup>('ANY');
  const gameModeRef = useRef<GameMode>('2P');

  // Keep refs in sync with state for access in 60fps loop
  useEffect(() => {
    activePlayerRef.current = activePlayer;
    p1GroupRef.current = p1Group;
    p2GroupRef.current = p2Group;
    gameModeRef.current = gameMode;
  }, [activePlayer, p1Group, p2Group, gameMode]);

  // 6 Pockets
  const pocketsRef = useRef<Pocket[]>([
    { x: FELT_X + 4, y: FELT_Y + 4, radius: 19, type: 'corner' },
    { x: FELT_X + FELT_WIDTH / 2, y: FELT_Y + 1, radius: 18, type: 'side' },
    { x: FELT_X + FELT_WIDTH - 4, y: FELT_Y + 4, radius: 19, type: 'corner' },
    { x: FELT_X + 4, y: FELT_Y + FELT_HEIGHT - 4, radius: 19, type: 'corner' },
    { x: FELT_X + FELT_WIDTH / 2, y: FELT_Y + FELT_HEIGHT - 1, radius: 18, type: 'side' },
    { x: FELT_X + FELT_WIDTH - 4, y: FELT_Y + FELT_HEIGHT - 4, radius: 19, type: 'corner' },
  ]);

  // Setup Standard 8-Ball Triangle Rack
  const setupRack = useCallback(() => {
    const balls: Ball[] = [];

    // Cue Ball on Headstring
    const whiteBall: Ball = {
      id: 0,
      number: 0,
      x: FELT_X + FELT_WIDTH * 0.28,
      y: FELT_Y + FELT_HEIGHT * 0.5,
      vx: 0,
      vy: 0,
      radius: BALL_R,
      color: '#f8fafc',
      isStriped: false,
      potted: false,
      scale: 1,
    };
    balls.push(whiteBall);
    cueBallRef.current = whiteBall;

    // Rack Apex on Foot Spot
    const apexX = FELT_X + FELT_WIDTH * 0.72;
    const apexY = FELT_Y + FELT_HEIGHT * 0.5;
    const spacing = BALL_R * 2 + 0.5;

    // 8-Ball Official Layout with 8 in center
    const rackLayout = [
      [1],
      [9, 2],
      [3, 8, 10],
      [11, 4, 12, 5],
      [6, 13, 7, 14, 15],
    ];

    let ballId = 1;
    for (let col = 0; col < rackLayout.length; col++) {
      const rowBalls = rackLayout[col];
      const colX = apexX + col * (spacing * 0.866);
      const startY = apexY - ((rowBalls.length - 1) * spacing) / 2;

      for (let row = 0; row < rowBalls.length; row++) {
        const num = rowBalls[row];
        balls.push({
          id: ballId++,
          number: num,
          x: colX,
          y: startY + row * spacing,
          vx: 0,
          vy: 0,
          radius: BALL_R,
          color: BALL_COLORS[num] || '#eab308',
          isStriped: num > 8,
          potted: false,
          scale: 1,
        });
      }
    }

    ballsRef.current = balls;
    particlesRef.current = [];
    floatingTextsRef.current = [];
    isMovingRef.current = false;
    setIsMoving(false);
    setIsAiThinking(false);
    setPottedNumbers([]);

    setActivePlayer(1);
    setP1Group('ANY');
    setP2Group('ANY');
    setP1Score(0);
    setP2Score(0);
    setShotsCount(0);
    setWinner(null);
    setWinReason('');
    setStatusMessage('Jogador 1: Mire e dê a tacada de abertura (Estouro do Rack)!');
    setCueAngle(0);
  }, []);

  const startNewGame = useCallback((mode?: GameMode) => {
    if (mode) setGameMode(mode);
    setupRack();
    setGameState('PLAYING');
    sound.playClick();
  }, [setupRack]);

  // Execute Cue Shot
  const executeShot = useCallback((overridePower?: number, overrideAngle?: number) => {
    const cue = cueBallRef.current;
    if (!cue || cue.potted || isMovingRef.current) return;

    const chosenPower = overridePower ?? power;
    const chosenAngle = overrideAngle ?? cueAngle;

    const shotStrength = chosenPower / 100;
    const speed = 3.5 + shotStrength * 18;

    cue.vx = Math.cos(chosenAngle) * speed;
    cue.vy = Math.sin(chosenAngle) * speed;

    sound.playCueHit(shotStrength);
    isMovingRef.current = true;
    setIsMoving(true);
    setShotsCount((c) => c + 1);

    // Reset shot track
    shotPottedBallsRef.current = [];
    cuePottedThisShotRef.current = false;
    eightPottedThisShotRef.current = false;

    const curPName = activePlayer === 1 ? 'Jogador 1' : gameMode === 'VS_AI' ? 'Computador' : 'Jogador 2';
    setStatusMessage(`Tacada de ${curPName}! Bolas em movimento...`);

    // Sparks
    for (let i = 0; i < 8; i++) {
      particlesRef.current.push({
        x: cue.x,
        y: cue.y,
        vx: -Math.cos(chosenAngle) * 3 + (Math.random() - 0.5) * 3,
        vy: -Math.sin(chosenAngle) * 3 + (Math.random() - 0.5) * 3,
        color: '#f8fafc',
        alpha: 1,
        size: 2.5,
      });
    }
  }, [cueAngle, power, activePlayer, gameMode]);

  // AI Shot Calculation & Execution
  const triggerAiTurn = useCallback(() => {
    if (activePlayerRef.current !== 2 || gameModeRef.current !== 'VS_AI') return;
    setIsAiThinking(true);
    setStatusMessage('🤖 Computador analisando a mesa...');

    setTimeout(() => {
      const cue = cueBallRef.current;
      if (!cue || isMovingRef.current) {
        setIsAiThinking(false);
        return;
      }

      // Determine available target balls for AI
      const group = p2GroupRef.current;
      const targetBalls = ballsRef.current.filter((b) => {
        if (b.number === 0 || b.potted) return false;
        if (group === 'SOLIDS') return b.number >= 1 && b.number <= 7;
        if (group === 'STRIPES') return b.number >= 9 && b.number <= 15;
        // If group is ANY, any ball except 8
        return b.number !== 8;
      });

      // If all group balls are potted, target the 8-ball!
      let eligible = targetBalls;
      if (eligible.length === 0) {
        const ball8 = ballsRef.current.find((b) => b.number === 8 && !b.potted);
        if (ball8) eligible = [ball8];
      }

      if (eligible.length === 0) {
        setIsAiThinking(false);
        return;
      }

      // Find the ball with the cleanest shot toward any pocket
      let bestAngle = 0;
      let bestDist = Infinity;
      const pockets = pocketsRef.current;

      for (const target of eligible) {
        for (const p of pockets) {
          // Pocket vector from target
          const tpX = p.x - target.x;
          const tpY = p.y - target.y;
          const tpDist = Math.hypot(tpX, tpY);
          if (tpDist === 0) continue;
          const tpNx = tpX / tpDist;
          const tpNy = tpY / tpDist;

          // Ghost ball position where cue ball must strike target
          const ghostX = target.x - tpNx * (BALL_R * 2);
          const ghostY = target.y - tpNy * (BALL_R * 2);

          // Vector from cue ball to ghost ball
          const cgX = ghostX - cue.x;
          const cgY = ghostY - cue.y;
          const cgDist = Math.hypot(cgX, cgY);

          // Check if shot is generally forward (dot product > 0.1)
          const dot = (cgX * tpNx + cgY * tpNy) / (cgDist || 1);
          if (dot > 0.1 && cgDist < bestDist) {
            bestDist = cgDist;
            // Add tiny human-like variance (± 0.02 rad)
            const variance = (Math.random() - 0.5) * 0.035;
            bestAngle = Math.atan2(cgY, cgX) + variance;
          }
        }
      }

      // If no ideal angle found, just aim at closest target
      if (bestDist === Infinity && eligible[0]) {
        const t = eligible[0];
        bestAngle = Math.atan2(t.y - cue.y, t.x - cue.x);
      }

      setCueAngle(bestAngle);
      const aiPower = Math.min(85, Math.max(45, Math.round(bestDist / 4)));
      setPower(aiPower);

      // Brief animation pause before shooting
      setTimeout(() => {
        setIsAiThinking(false);
        executeShot(aiPower, bestAngle);
      }, 700);
    }, 900);
  }, [executeShot]);

  // Turn Arbitration when all balls stop
  const handleTurnResolution = useCallback(() => {
    const cuePotted = cuePottedThisShotRef.current;
    const eightPotted = eightPottedThisShotRef.current;
    const pottedList = shotPottedBallsRef.current;
    const curP = activePlayerRef.current;
    const p1G = p1GroupRef.current;
    const p2G = p2GroupRef.current;
    const mode = gameModeRef.current;

    const p1Name = 'Jogador 1';
    const p2Name = mode === 'VS_AI' ? 'Computador' : 'Jogador 2';
    const curName = curP === 1 ? p1Name : p2Name;
    const otherName = curP === 1 ? p2Name : p1Name;

    // 1. Eight Ball Handling
    if (eightPotted) {
      const curGroup = curP === 1 ? p1G : p2G;
      const ballsLeft = ballsRef.current.filter((b) => {
        if (b.potted || b.number === 0 || b.number === 8) return false;
        if (curGroup === 'SOLIDS') return b.number >= 1 && b.number <= 7;
        if (curGroup === 'STRIPES') return b.number >= 9 && b.number <= 15;
        return true;
      }).length;

      if (ballsLeft === 0 && !cuePotted) {
        // Legal 8-Ball pot -> VICTORY!
        sound.playCheer();
        setWinner(curName);
        setWinReason(`${curName} encaçapou a Bola 8 legalmente e venceu a partida!`);
        setGameState('GAMEOVER');
        if (curP === 1) {
          setP1Wins((w) => w + 1);
          awardAuraWin('Sinuca de Bar');
        } else {
          setP2Wins((w) => w + 1);
        }
        return;
      } else {
        // Illegal 8-Ball pot (too early OR potted cue ball together) -> OPPONENT WINS!
        sound.playGameOver();
        setWinner(otherName);
        setWinReason(
          cuePotted
            ? `${curName} encaçapou a Bola 8 junto com a branca! Vitória de ${otherName}!`
            : `${curName} encaçapou a Bola 8 antes de limpar suas bolas! Vitória de ${otherName}!`
        );
        setGameState('GAMEOVER');
        if (curP === 1) setP2Wins((w) => w + 1);
        else setP1Wins((w) => w + 1);
        return;
      }
    }

    // 2. Cue Ball Foul (Scratch / Branca na Caçapa)
    if (cuePotted) {
      sound.playBuzzer();
      floatingTextsRef.current.push({
        id: Date.now() + Math.random(),
        x: TABLE_WIDTH / 2,
        y: TABLE_HEIGHT / 2 - 20,
        text: 'FALTA! BOLA BRANCA!',
        color: '#ef4444',
        alpha: 1,
      });

      // Switch turn with penalty announcement
      const nextP = curP === 1 ? 2 : 1;
      const nextName = nextP === 1 ? p1Name : p2Name;
      setActivePlayer(nextP);
      setStatusMessage(`Falta de ${curName}! A bola branca caiu. Vez de ${nextName}!`);

      if (nextP === 2 && mode === 'VS_AI') {
        setTimeout(triggerAiTurn, 1000);
      }
      return;
    }

    // 3. Regular Object Balls Evaluation
    if (pottedList.length === 0) {
      // No ball potted -> Switch Turn!
      const nextP = curP === 1 ? 2 : 1;
      const nextName = nextP === 1 ? p1Name : p2Name;
      setActivePlayer(nextP);
      setStatusMessage(`Nenhuma bola encaçapada. Vez de ${nextName}!`);

      if (nextP === 2 && mode === 'VS_AI') {
        setTimeout(triggerAiTurn, 1000);
      }
      return;
    }

    // Balls WERE potted!
    // Check if groups are assigned yet
    if (p1G === 'ANY' && p2G === 'ANY') {
      const firstBall = pottedList[0];
      const isSolid = firstBall >= 1 && firstBall <= 7;
      const chosenForCur = isSolid ? 'SOLIDS' : 'STRIPES';
      const chosenForOther = isSolid ? 'STRIPES' : 'SOLIDS';

      if (curP === 1) {
        setP1Group(chosenForCur);
        setP2Group(chosenForOther);
      } else {
        setP2Group(chosenForCur);
        setP1Group(chosenForOther);
      }

      sound.playCorrectDing();
      const groupLabel = isSolid ? 'Lisas (1 a 7)' : 'Listradas (9 a 15)';
      setStatusMessage(`${curName} encaçapou a bola ${firstBall}! Fica com as ${groupLabel} e continua na mesa!`);
      // Active player stays on table
      if (curP === 2 && mode === 'VS_AI') {
        setTimeout(triggerAiTurn, 1000);
      }
      return;
    }

    // Groups are already assigned: check if player potted at least one of their group's balls
    const curGroup = curP === 1 ? p1G : p2G;
    const pottedOwnGroup = pottedList.some((num) => {
      if (curGroup === 'SOLIDS') return num >= 1 && num <= 7;
      if (curGroup === 'STRIPES') return num >= 9 && num <= 15;
      return false;
    });

    if (pottedOwnGroup) {
      sound.playCorrectDing();
      setStatusMessage(`${curName} encaçapou sua bola e continua na mesa!`);
      if (curP === 2 && mode === 'VS_AI') {
        setTimeout(triggerAiTurn, 1000);
      }
    } else {
      // Potted only opponent's ball -> Foul/Pass turn!
      const nextP = curP === 1 ? 2 : 1;
      const nextName = nextP === 1 ? p1Name : p2Name;
      setActivePlayer(nextP);
      setStatusMessage(`${curName} encaçapou bola adversária! Vez de ${nextName}!`);
      if (nextP === 2 && mode === 'VS_AI') {
        setTimeout(triggerAiTurn, 1000);
      }
    }
  }, [triggerAiTurn]);

  // Handle Aiming with pointer
  const handlePointerAim = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const cue = cueBallRef.current;
    if (!canvas || !cue || cue.potted || isMovingRef.current || isAiThinking) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = TABLE_WIDTH / rect.width;
    const scaleY = TABLE_HEIGHT / rect.height;

    const mouseX = (clientX - rect.left) * scaleX;
    const mouseY = (clientY - rect.top) * scaleY;

    const dx = mouseX - cue.x;
    const dy = mouseY - cue.y;
    setCueAngle(Math.atan2(dy, dx));
  }, [isAiThinking]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'a', 'A', 'd', 'D', 'w', 'W', 's', 'S'].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setCueAngle((a) => a - 0.035);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setCueAngle((a) => a + 0.035);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        setPower((p) => Math.min(100, p + 5));
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        setPower((p) => Math.max(10, p - 5));
      } else if (e.key === ' ') {
        if (!isAiThinking && !isMovingRef.current) {
          executeShot();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeShot, isAiThinking]);

  // Physics Simulation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SUBSTEPS = 6;

    const loop = () => {
      if (gameState === 'PLAYING') {
        for (let step = 0; step < SUBSTEPS; step++) {
          updatePhysics(1 / SUBSTEPS);
        }
      }
      render(ctx);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    const updatePhysics = (dt: number) => {
      const balls = ballsRef.current;
      const pockets = pocketsRef.current;
      let totalMotion = 0;

      // 1. Move balls & Felt Friction
      for (const b of balls) {
        if (b.potted) {
          if (b.scale > 0.05) {
            b.scale = Math.max(0, b.scale - 0.08 * dt);
          }
          continue;
        }

        b.x += b.vx * dt;
        b.y += b.vy * dt;

        b.vx *= Math.pow(FRICTION, dt);
        b.vy *= Math.pow(FRICTION, dt);

        const speed = Math.hypot(b.vx, b.vy);
        if (speed < 0.06) {
          b.vx = 0;
          b.vy = 0;
        } else {
          totalMotion += speed;
        }

        // Cushion Boundaries
        const leftWall = FELT_X + b.radius + 3;
        const rightWall = FELT_X + FELT_WIDTH - b.radius - 3;
        const topWall = FELT_Y + b.radius + 3;
        const bottomWall = FELT_Y + FELT_HEIGHT - b.radius - 3;

        let nearPocket = false;
        for (const p of pockets) {
          if (Math.hypot(b.x - p.x, b.y - p.y) < p.radius + 6) {
            nearPocket = true;
            break;
          }
        }

        if (!nearPocket) {
          if (b.x < leftWall) {
            b.x = leftWall;
            b.vx = -b.vx * 0.88;
            sound.playCushion();
          }
          if (b.x > rightWall) {
            b.x = rightWall;
            b.vx = -b.vx * 0.88;
            sound.playCushion();
          }
          if (b.y < topWall) {
            b.y = topWall;
            b.vy = -b.vy * 0.88;
            sound.playCushion();
          }
          if (b.y > bottomWall) {
            b.y = bottomWall;
            b.vy = -b.vy * 0.88;
            sound.playCushion();
          }
        }

        // 2. Pocket Drops
        for (const p of pockets) {
          const distToPocket = Math.hypot(b.x - p.x, b.y - p.y);
          if (distToPocket < p.radius + 2) {
            b.potted = true;
            b.vx = 0;
            b.vy = 0;
            sound.playPocketDrop();

            for (let i = 0; i < 10; i++) {
              particlesRef.current.push({
                x: p.x,
                y: p.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                color: b.color === '#f8fafc' ? '#38bdf8' : b.color,
                alpha: 1,
                size: 3,
              });
            }

            if (b.number === 0) {
              cuePottedThisShotRef.current = true;
            } else if (b.number === 8) {
              eightPottedThisShotRef.current = true;
              setPottedNumbers((prev) => [...prev, 8]);
            } else {
              shotPottedBallsRef.current.push(b.number);
              setPottedNumbers((prev) => [...prev, b.number]);

              // Add score to active player
              const curP = activePlayerRef.current;
              const pts = 1000 * b.number;
              if (curP === 1) setP1Score((s) => s + pts);
              else setP2Score((s) => s + pts);

              floatingTextsRef.current.push({
                id: Date.now() + Math.random(),
                x: p.x,
                y: p.y - 15,
                text: `+${pts.toLocaleString('pt-BR')}`,
                color: b.color,
                alpha: 1,
              });
            }
            break;
          }
        }
      }

      // 3. Elastic Ball-to-Ball Collisions
      for (let i = 0; i < balls.length; i++) {
        const b1 = balls[i];
        if (b1.potted) continue;

        for (let j = i + 1; j < balls.length; j++) {
          const b2 = balls[j];
          if (b2.potted) continue;

          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.hypot(dx, dy);
          const minDist = b1.radius + b2.radius;

          if (dist < minDist && dist > 0) {
            const overlap = (minDist - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;

            b1.x -= nx * overlap;
            b1.y -= ny * overlap;
            b2.x += nx * overlap;
            b2.y += ny * overlap;

            const kx = b1.vx - b2.vx;
            const ky = b1.vy - b2.vy;
            const p = 2 * (nx * kx + ny * ky) / 2;

            const RESTITUTION = 0.96;
            b1.vx -= p * nx * RESTITUTION;
            b1.vy -= p * ny * RESTITUTION;
            b2.vx += p * nx * RESTITUTION;
            b2.vy += p * ny * RESTITUTION;

            const impactSpeed = Math.hypot(kx, ky);
            if (impactSpeed > 0.4) {
              sound.playBallClack(Math.min(1, impactSpeed / 8));
            }
          }
        }
      }

      // Check if all motion stopped
      if (isMovingRef.current && totalMotion === 0) {
        isMovingRef.current = false;
        setIsMoving(false);

        // Respawn Cue Ball if scratched
        const cue = cueBallRef.current;
        if (cue && cue.potted) {
          cue.x = FELT_X + FELT_WIDTH * 0.28;
          cue.y = FELT_Y + FELT_HEIGHT * 0.5;
          cue.vx = 0;
          cue.vy = 0;
          cue.potted = false;
          cue.scale = 1;
        }

        // Arbitrate Turn Results
        handleTurnResolution();
      }

      // 4. Update Particle & Floating Text
      particlesRef.current = particlesRef.current
        .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, alpha: p.alpha - 0.02 }))
        .filter((p) => p.alpha > 0);

      floatingTextsRef.current = floatingTextsRef.current
        .map((t) => ({ ...t, y: t.y - 0.6, alpha: t.alpha - 0.02 }))
        .filter((t) => t.alpha > 0);
    };

    // Render Table
    const render = (c: CanvasRenderingContext2D) => {
      // 1. Wood Cabinet Frame
      c.save();
      const woodGrad = c.createLinearGradient(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
      woodGrad.addColorStop(0, '#3e1f0e');
      woodGrad.addColorStop(0.5, '#5c2d13');
      woodGrad.addColorStop(1, '#2c1407');
      c.fillStyle = woodGrad;
      c.beginPath();
      c.roundRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT, 24);
      c.fill();

      // Brass Rim
      c.strokeStyle = '#b45309';
      c.lineWidth = 3;
      c.beginPath();
      c.roundRect(4, 4, TABLE_WIDTH - 8, TABLE_HEIGHT - 8, 22);
      c.stroke();

      // Sighting dots (Diamond Inlays)
      c.fillStyle = '#fef08a';
      for (let i = 1; i <= 5; i++) {
        const dx = FELT_X + (FELT_WIDTH / 6) * i;
        c.beginPath();
        c.arc(dx, FELT_Y / 2, 2.5, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(dx, TABLE_HEIGHT - FELT_Y / 2, 2.5, 0, Math.PI * 2);
        c.fill();
      }
      for (let i = 1; i <= 3; i++) {
        const dy = FELT_Y + (FELT_HEIGHT / 4) * i;
        c.beginPath();
        c.arc(FELT_X / 2, dy, 2.5, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(TABLE_WIDTH - FELT_X / 2, dy, 2.5, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();

      // 2. Green Felt Baize
      c.save();
      const feltGrad = c.createRadialGradient(
        TABLE_WIDTH / 2,
        TABLE_HEIGHT / 2,
        60,
        TABLE_WIDTH / 2,
        TABLE_HEIGHT / 2,
        340
      );
      feltGrad.addColorStop(0, '#15803d');
      feltGrad.addColorStop(0.8, '#166534');
      feltGrad.addColorStop(1, '#14532d');
      c.fillStyle = feltGrad;
      c.fillRect(FELT_X, FELT_Y, FELT_WIDTH, FELT_HEIGHT);

      // Cushion inner shadow
      c.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      c.lineWidth = 5;
      c.strokeRect(FELT_X + 2, FELT_Y + 2, FELT_WIDTH - 4, FELT_HEIGHT - 4);

      // Break Line
      c.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      c.lineWidth = 1.5;
      const breakLineX = FELT_X + FELT_WIDTH * 0.28;
      c.beginPath();
      c.moveTo(breakLineX, FELT_Y + 8);
      c.lineTo(breakLineX, FELT_Y + FELT_HEIGHT - 8);
      c.stroke();
      c.restore();

      // 3. Pockets
      pocketsRef.current.forEach((p) => {
        c.save();
        c.strokeStyle = '#ca8a04';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(p.x, p.y, p.radius + 3, 0, Math.PI * 2);
        c.stroke();

        c.fillStyle = '#09090b';
        c.beginPath();
        c.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        c.fill();
        c.restore();
      });

      // 4. Balls
      ballsRef.current.forEach((b) => {
        if (b.potted && b.scale <= 0.05) return;

        c.save();
        c.translate(b.x, b.y);
        c.scale(b.scale, b.scale);

        c.shadowColor = 'rgba(0, 0, 0, 0.5)';
        c.shadowBlur = 4;
        c.shadowOffsetX = 2;
        c.shadowOffsetY = 2;

        if (b.number === 0) {
          const grad = c.createRadialGradient(-3, -3, 1, 0, 0, b.radius);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.7, '#f1f5f9');
          grad.addColorStop(1, '#cbd5e1');
          c.fillStyle = grad;
          c.beginPath();
          c.arc(0, 0, b.radius, 0, Math.PI * 2);
          c.fill();

          c.fillStyle = '#ef4444';
          c.beginPath();
          c.arc(1.5, -1.5, 1.2, 0, Math.PI * 2);
          c.fill();
        } else {
          if (b.isStriped) {
            c.fillStyle = '#ffffff';
            c.beginPath();
            c.arc(0, 0, b.radius, 0, Math.PI * 2);
            c.fill();

            c.fillStyle = b.color;
            c.beginPath();
            c.arc(0, 0, b.radius, -0.65, 0.65);
            c.lineTo(Math.cos(Math.PI - 0.65) * b.radius, Math.sin(Math.PI - 0.65) * b.radius);
            c.arc(0, 0, b.radius, Math.PI - 0.65, Math.PI + 0.65);
            c.closePath();
            c.fill();
          } else {
            const grad = c.createRadialGradient(-3, -3, 1, 0, 0, b.radius);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.3, b.color);
            grad.addColorStop(1, b.number === 8 ? '#000000' : '#1e293b');
            c.fillStyle = grad;
            c.beginPath();
            c.arc(0, 0, b.radius, 0, Math.PI * 2);
            c.fill();
          }

          c.fillStyle = '#ffffff';
          c.beginPath();
          c.arc(0, 0, 4.2, 0, Math.PI * 2);
          c.fill();

          c.fillStyle = '#0f172a';
          c.font = 'bold 5.5px monospace';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(`${b.number}`, 0, 0.5);
        }
        c.restore();
      });

      // 5. Aiming Line & Cue Stick
      const cue = cueBallRef.current;
      if (cue && !cue.potted && !isMovingRef.current && gameState === 'PLAYING') {
        c.save();
        const maxDist = 380;
        const dirX = Math.cos(cueAngle);
        const dirY = Math.sin(cueAngle);

        let closestHitDist = maxDist;
        let hitBall: Ball | null = null;

        ballsRef.current.forEach((other) => {
          if (other.number === 0 || other.potted) return;
          const ox = other.x - cue.x;
          const oy = other.y - cue.y;
          const dot = ox * dirX + oy * dirY;
          if (dot > 0 && dot < closestHitDist) {
            const perpDist = Math.abs(ox * dirY - oy * dirX);
            if (perpDist < cue.radius + other.radius) {
              const d = dot - Math.sqrt(Math.max(0, (cue.radius + other.radius) ** 2 - perpDist ** 2));
              if (d > 0 && d < closestHitDist) {
                closestHitDist = d;
                hitBall = other;
              }
            }
          }
        });

        // Laser Aiming Line
        c.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        c.lineWidth = 1.5;
        c.setLineDash([4, 4]);
        c.beginPath();
        c.moveTo(cue.x, cue.y);
        c.lineTo(cue.x + dirX * closestHitDist, cue.y + dirY * closestHitDist);
        c.stroke();
        c.setLineDash([]);

        // Ghost Cue Ball
        if (hitBall) {
          const ghostX = cue.x + dirX * closestHitDist;
          const ghostY = cue.y + dirY * closestHitDist;

          c.strokeStyle = 'rgba(56, 189, 248, 0.8)';
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(ghostX, ghostY, cue.radius, 0, Math.PI * 2);
          c.stroke();

          const hitDx = (hitBall as Ball).x - ghostX;
          const hitDy = (hitBall as Ball).y - ghostY;
          const hitDist = Math.hypot(hitDx, hitDy);
          if (hitDist > 0) {
            const nx = hitDx / hitDist;
            const ny = hitDy / hitDist;
            c.strokeStyle = '#facc15';
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo((hitBall as Ball).x, (hitBall as Ball).y);
            c.lineTo((hitBall as Ball).x + nx * 35, (hitBall as Ball).y + ny * 35);
            c.stroke();
          }
        }

        // Cue Stick
        const pullback = (power / 100) * 28 + (isChargingShot ? 6 : 0);
        const cueLength = 175;
        const cueDist = cue.radius + 8 + pullback;

        c.save();
        c.translate(cue.x, cue.y);
        c.rotate(cueAngle + Math.PI);

        const cueGrad = c.createLinearGradient(cueDist, 0, cueDist + cueLength, 0);
        cueGrad.addColorStop(0, '#fef3c7');
        cueGrad.addColorStop(0.06, '#d97706');
        cueGrad.addColorStop(0.65, '#92400e');
        cueGrad.addColorStop(1, '#451a03');

        c.fillStyle = cueGrad;
        c.beginPath();
        c.moveTo(cueDist, -2);
        c.lineTo(cueDist + cueLength, -5.5);
        c.lineTo(cueDist + cueLength, 5.5);
        c.lineTo(cueDist, 2);
        c.closePath();
        c.fill();

        c.fillStyle = '#0284c7';
        c.fillRect(cueDist - 2.5, -2, 2.5, 4);

        c.fillStyle = '#ffffff';
        c.fillRect(cueDist, -2, 4, 4);
        c.restore();
        c.restore();
      }

      // 6. Floating Scores Text
      floatingTextsRef.current.forEach((t) => {
        c.save();
        c.globalAlpha = t.alpha;
        c.font = 'bold 12px monospace';
        c.fillStyle = t.color;
        c.textAlign = 'center';
        c.shadowColor = '#000000';
        c.shadowBlur = 4;
        c.fillText(t.text, t.x, t.y);
        c.restore();
      });

      // 7. Particles
      particlesRef.current.forEach((p) => {
        c.save();
        c.globalAlpha = p.alpha;
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.fill();
        c.restore();
      });
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState, cueAngle, power, isChargingShot, handleTurnResolution]);

  // Remaining balls for each group (computed from reactive state)
  const solidsRemaining = [1, 2, 3, 4, 5, 6, 7].filter((n) => !pottedNumbers.includes(n));
  const stripesRemaining = [9, 10, 11, 12, 13, 14, 15].filter((n) => !pottedNumbers.includes(n));

  const p1Balls = p1Group === 'SOLIDS' ? solidsRemaining : p1Group === 'STRIPES' ? stripesRemaining : [];
  const p2Balls = p2Group === 'SOLIDS' ? solidsRemaining : p2Group === 'STRIPES' ? stripesRemaining : [];

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto font-sans select-none">
      {/* MULTIPLAYER HEADER HUD: PLAYER 1 vs PLAYER 2 */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-t-2xl p-3 flex flex-col gap-2.5 shadow-xl">
        {/* Top Mode Selector Tabs */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => startNewGame('2P')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                gameMode === '2P'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>2 Jogadores (1x1)</span>
            </button>

            <button
              onClick={() => startNewGame('VS_AI')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                gameMode === 'VS_AI'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Contra a IA (Robô)</span>
            </button>

            <button
              onClick={() => startNewGame('SOLO')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                gameMode === 'SOLO'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Treino Solo</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>PLACAR:</span>
            <span className="text-cyan-400 font-bold">{p1Wins}</span>
            <span>x</span>
            <span className="text-amber-400 font-bold">{p2Wins}</span>
          </div>
        </div>

        {/* Players Status Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Player 1 Card */}
          <div
            className={`p-2.5 rounded-xl border transition-all flex flex-col gap-1.5 ${
              activePlayer === 1
                ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400/50'
                : 'bg-slate-950/60 border-slate-800 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 text-xs font-bold">
                  1
                </div>
                <span className="font-extrabold text-white text-xs sm:text-sm">Jogador 1</span>
              </div>

              {activePlayer === 1 && (
                <span className="px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-black animate-pulse">
                  SUA VEZ
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 text-[11px]">
                {p1Group === 'SOLIDS'
                  ? 'Lisas (1 a 7)'
                  : p1Group === 'STRIPES'
                  ? 'Listradas (9 a 15)'
                  : 'A Definir'}
              </span>
              <span className="font-black text-cyan-400">{p1Score.toLocaleString('pt-BR')} pts</span>
            </div>

            {/* Balls Tray */}
            {p1Group !== 'ANY' && (
              <div className="flex items-center gap-1 overflow-x-auto pt-0.5">
                {p1Balls.length === 0 ? (
                  <span className="text-[10px] text-amber-400 font-bold animate-pulse">🎱 BOLA 8 PARA VENCER!</span>
                ) : (
                  p1Balls.map((num) => (
                    <div
                      key={num}
                      className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                      style={{ backgroundColor: BALL_COLORS[num] }}
                    >
                      {num}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Player 2 Card (or CPU) */}
          <div
            className={`p-2.5 rounded-xl border transition-all flex flex-col gap-1.5 ${
              activePlayer === 2
                ? 'bg-amber-950/40 border-amber-400 shadow-md shadow-amber-500/20 ring-1 ring-amber-400/50'
                : 'bg-slate-950/60 border-slate-800 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300 text-xs font-bold">
                  {gameMode === 'VS_AI' ? '🤖' : '2'}
                </div>
                <span className="font-extrabold text-white text-xs sm:text-sm">
                  {gameMode === 'VS_AI' ? 'Computador (IA)' : 'Jogador 2'}
                </span>
              </div>

              {activePlayer === 2 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black animate-pulse">
                  {isAiThinking ? 'PENSANDO...' : 'SUA VEZ'}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 text-[11px]">
                {p2Group === 'SOLIDS'
                  ? 'Lisas (1 a 7)'
                  : p2Group === 'STRIPES'
                  ? 'Listradas (9 a 15)'
                  : 'A Definir'}
              </span>
              <span className="font-black text-amber-400">{p2Score.toLocaleString('pt-BR')} pts</span>
            </div>

            {/* Balls Tray */}
            {p2Group !== 'ANY' && (
              <div className="flex items-center gap-1 overflow-x-auto pt-0.5">
                {p2Balls.length === 0 ? (
                  <span className="text-[10px] text-amber-400 font-bold animate-pulse">🎱 BOLA 8 PARA VENCER!</span>
                ) : (
                  p2Balls.map((num) => (
                    <div
                      key={num}
                      className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                      style={{ backgroundColor: BALL_COLORS[num] }}
                    >
                      {num}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Canvas */}
      <div className="relative w-full aspect-[680/380] max-h-[380px] bg-slate-950 border-x border-slate-800 overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={TABLE_WIDTH}
          height={TABLE_HEIGHT}
          className="w-full h-full block cursor-crosshair"
          onPointerDown={(e) => {
            if (activePlayer === 2 && gameMode === 'VS_AI') return;
            isDraggingCueRef.current = true;
            handlePointerAim(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (isDraggingCueRef.current) {
              handlePointerAim(e.clientX, e.clientY);
            }
          }}
          onPointerUp={() => {
            isDraggingCueRef.current = false;
          }}
          onPointerLeave={() => {
            isDraggingCueRef.current = false;
          }}
        />

        {/* Start Game Overlay */}
        {gameState === 'IDLE' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/20 text-3xl">
              🎱
            </div>
            <h3 className="text-2xl font-black text-white mb-1">Sinuca de Bar Multiplayer</h3>
            <p className="text-xs text-emerald-400 font-mono mb-4 uppercase tracking-widest">
              Regras Oficiais da Bola 8 · 1x1 Local ou vs IA
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              <button
                onClick={() => startNewGame('2P')}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
              >
                <Users className="w-4 h-4" />
                2 Jogadores (Pass & Play)
              </button>

              <button
                onClick={() => startNewGame('VS_AI')}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 transition-all"
              >
                <Bot className="w-4 h-4" />
                Contra o Computador
              </button>
            </div>
          </div>
        )}

        {/* Game Over / Victory Modal */}
        {gameState === 'GAMEOVER' && winner && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="text-4xl mb-2 animate-bounce">🏆 🎱 ✨</div>
            <div className="text-amber-400 font-mono text-xs tracking-widest font-bold mb-1">
              FIM DA PARTIDA
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white mb-2">
              Vitória de {winner}!
            </h3>
            <p className="text-xs text-slate-300 max-w-sm mb-6 leading-relaxed">
              {winReason}
            </p>
            <button
              onClick={() => startNewGame()}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Jogar Revanche
            </button>
          </div>
        )}
      </div>

      {/* Billiards Controls: Power Meter, Fine-tuning, & Action Bar */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-b-2xl p-3 flex flex-col gap-3">
        {/* Dynamic Status / Referee Marquee */}
        <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-300 font-medium">
            <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{statusMessage}</span>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            Tacadas: <span className="text-slate-200 font-bold">{shotsCount}</span>
          </div>
        </div>

        {/* Shot Power Slider & Shoot Buttons */}
        <div className="flex items-center gap-3 w-full">
          {/* Fine Tune Angle Buttons */}
          <button
            type="button"
            disabled={isAiThinking || isMoving}
            onClick={() => setCueAngle((a) => a - 0.04)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 active:scale-95"
            title="Girar mira para esquerda (A / Seta Esq)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Power Bar */}
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>FORÇA DA TACADA</span>
              <span className="font-bold text-emerald-400">{power}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              disabled={isAiThinking || isMoving}
              value={power}
              onChange={(e) => setPower(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg disabled:opacity-40"
            />
          </div>

          <button
            type="button"
            disabled={isAiThinking || isMoving}
            onClick={() => setCueAngle((a) => a + 0.04)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 active:scale-95"
            title="Girar mira para direita (D / Seta Dir)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Big Shoot Button */}
          <button
            type="button"
            disabled={gameState !== 'PLAYING' || isMoving || (activePlayer === 2 && gameMode === 'VS_AI')}
            onClick={() => executeShot()}
            onPointerDown={() => setIsChargingShot(true)}
            onPointerUp={() => {
              setIsChargingShot(false);
              executeShot();
            }}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:opacity-40 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all shrink-0 flex items-center gap-1.5"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>TACADA!</span>
          </button>
        </div>

        {/* Footer info & Controls */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800">
          <button
            onClick={() => startNewGame()}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reiniciar Mesa
          </button>

          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
            Clique e arraste na mesa para mirar · Espaço para dar a tacada
          </span>
        </div>
      </div>
    </div>
  );
}
