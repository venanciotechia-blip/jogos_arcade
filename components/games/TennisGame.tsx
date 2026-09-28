'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Trophy, Award, Zap, Volume2, Shield, Settings2, Sparkles, ChevronRight, Activity } from 'lucide-react';
import { sound } from '@/lib/sound';
import { getHighScore, saveHighScore } from '@/lib/gameStore';
import { awardAuraWin, triggerDefeat } from '@/lib/auraStore';

export type CourtSurface = 'concreto' | 'saibro' | 'grama';
export type ShotType = 'flat' | 'topspin' | 'slice';
export type GameState = 'MENU' | 'PLAYING' | 'POINT_PAUSE' | 'GAME_OVER';

interface CourtConfig {
  id: CourtSurface;
  name: string;
  location: string;
  innerColor: string;
  outerColor: string;
  lineColor: string;
  restitution: number; // bounce height
  friction: number;    // speed preservation after bounce
  spinMultiplier: number;
  dustColor: string;
  description: string;
  speedRating: string;
  bounceRating: string;
  spinRating: string;
}

const COURTS: Record<CourtSurface, CourtConfig> = {
  concreto: {
    id: 'concreto',
    name: 'Concreto (Hard Court)',
    location: 'US Open • Nova York',
    innerColor: '#1d4ed8', // Vibrant US Open Blue
    outerColor: '#0f2b59', // Dark Navy Surround
    lineColor: '#ffffff',
    restitution: 0.78,     // Medium-high predictable bounce
    friction: 0.88,        // Medium-fast surface
    spinMultiplier: 1.0,
    dustColor: 'rgba(255, 255, 255, 0.4)',
    description: 'Piso equilibrado e rápido. Quique previsível e trocas velozes na linha de base.',
    speedRating: '⚡⚡⚡ Rápida',
    bounceRating: '🎾🎾 Médio',
    spinRating: '🌀🌀 Médio',
  },
  saibro: {
    id: 'saibro',
    name: 'Saibro (Clay Court)',
    location: 'Roland Garros • Paris',
    innerColor: '#c25624', // Terracotta ochre clay
    outerColor: '#254b2d', // Deep Forest Green surround
    lineColor: '#fef08a',  // Chalky yellow-white lines
    restitution: 0.88,     // Higher bounce
    friction: 0.74,        // High friction, ball slows down significantly on bounce
    spinMultiplier: 1.35,  // Heavy kick on topspin!
    dustColor: '#ea580c',  // Clay dust puffs
    description: 'Piso lento com quique alto e deslizamento. Ralis táticos longos onde o Topspin é rei!',
    speedRating: '⚡⚡ Lenta/Tática',
    bounceRating: '🎾🎾🎾 Alto',
    spinRating: '🌀🌀🌀 Máximo (Topspin)',
  },
  grama: {
    id: 'grama',
    name: 'Grama Sagrada (Grass)',
    location: 'Wimbledon • Londres',
    innerColor: '#15803d', // Mowed lawn emerald green
    outerColor: '#3b0764', // Royal Wimbledon Purple surround
    lineColor: '#ffffff',
    restitution: 0.58,     // Low, skidding bounce!
    friction: 0.94,        // Ball slides through with high pace
    spinMultiplier: 1.25,  // Slices skid extremely low
    dustColor: '#86efac',  // Grass blade fragments
    description: 'Piso ultra-rápido com quique baixo e escorregadio. Cortadas e saques abertos são fatais!',
    speedRating: '⚡⚡⚡⚡ Ultra Rápida',
    bounceRating: '🎾 Baixo / Skidding',
    spinRating: '🌀🌀🌀 Cortadas (Slice)',
  },
};

// Canvas World Proportions
const CANVAS_WIDTH = 520;
const CANVAS_HEIGHT = 620;

// Court 3D Perspective Projection Box
// Y=120 (Opponent baseline) to Y=490 (Player baseline), Net at Y=305
const NET_Y = 305;
const OPPONENT_BASELINE_Y = 130;
const PLAYER_BASELINE_Y = 490;
const OPPONENT_WIDTH = 250;
const PLAYER_WIDTH = 420;
const COURT_CENTER_X = CANVAS_WIDTH / 2;

// Projection helper: transforms normalized court pos (u: -1 to 1 across width, v: -1 to 1 lengthwise from opponent to player)
function projectCourt(u: number, v: number): { x: number; y: number } {
  // v ranges from -1 (opponent baseline) to +1 (player baseline)
  const normV = (v + 1) / 2; // 0 (opponent) to 1 (player)
  const courtY = OPPONENT_BASELINE_Y + normV * (PLAYER_BASELINE_Y - OPPONENT_BASELINE_Y);
  const currentWidth = OPPONENT_WIDTH + normV * (PLAYER_WIDTH - OPPONENT_WIDTH);
  const courtX = COURT_CENTER_X + (u / 2) * currentWidth;
  return { x: courtX, y: courtY };
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

export function TennisGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Match Configuration
  const [court, setCourt] = useState<CourtSurface>('concreto');
  const [matchLength, setMatchLength] = useState<number>(3); // 1 or 3 games to win set
  const [gameState, setGameState] = useState<GameState>('MENU');

  // Tennis Score State
  const [playerPoints, setPlayerPoints] = useState(0); // 0, 1(15), 2(30), 3(40), 4(Game/Adv)
  const [cpuPoints, setCpuPoints] = useState(0);
  const [playerGames, setPlayerGames] = useState(0);
  const [cpuGames, setCpuGames] = useState(0);
  const [currentServer, setCurrentServer] = useState<'PLAYER' | 'CPU'>('PLAYER');
  const [serveFaultCount, setServeFaultCount] = useState(0); // 0 = 1st serve, 1 = 2nd serve
  const [lastShotSpeed, setLastShotSpeed] = useState<number>(0);
  const [lastShotType, setLastShotType] = useState<ShotType>('flat');
  const [announcement, setAnnouncement] = useState('ESCOLHA A QUADRA E INICIE A PARTIDA');
  const [rallyCount, setRallyCount] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => getHighScore('tennis'));

  // Shot Power Charge & Selection
  const [isCharging, setIsCharging] = useState(false);
  const [chargePower, setChargePower] = useState(0); // 0.0 to 1.0
  const [selectedSpin, setSelectedSpin] = useState<ShotType>('flat');

  // Serve specific state
  const [servePhase, setServePhase] = useState<'READY' | 'TOSSING' | 'PLAY'>('READY');
  const [serveTossProgress, setServeTossProgress] = useState(0); // 0 to 1 (apex around 0.7-0.8)

  // References for Animation & Physics Loop
  const animFrameRef = useRef<number | null>(null);
  const currentCourtConfig = COURTS[court];
  const courtConfigRef = useRef<CourtConfig>(currentCourtConfig);

  useEffect(() => {
    courtConfigRef.current = COURTS[court];
  }, [court]);

  // Ball State (3D normalized court space)
  // u: -1 to 1 (left to right)
  // v: -1 to 1 (opponent baseline to player baseline)
  // z: 0 to 120 (height in units above ground)
  const ballRef = useRef({
    u: 0.3,
    v: 0.98,
    z: 25,
    vu: 0,
    vv: 0,
    vz: 0,
    spinType: 'flat' as ShotType,
    spinU: 0, // sidespin
    spinV: 0, // topspin / slice
    lastHitter: 'NONE' as 'PLAYER' | 'CPU' | 'NONE',
    bouncesSinceHit: 0,
    active: false,
    speedKmh: 0,
    trail: [] as { x: number; y: number; alpha: number; color: string }[],
  });

  // Player State
  const playerRef = useRef({
    u: 0.3,
    v: 0.95,
    targetU: 0.3,
    targetV: 0.95,
    swingTimer: 0,
    swingType: 'flat' as ShotType,
    facing: 'UP',
    dustTimer: 0,
  });

  // CPU State
  const cpuRef = useRef({
    u: -0.3,
    v: -0.92,
    targetU: -0.3,
    targetV: -0.92,
    swingTimer: 0,
    swingType: 'flat' as ShotType,
    facing: 'DOWN',
    reactionDelay: 0,
  });

  const particlesRef = useRef<Particle[]>([]);
  const keysDownRef = useRef<Record<string, boolean>>({});
  const chargeStartTimeRef = useRef<number>(0);
  const serveTossStartRef = useRef<number>(0);

  // Format Tennis Points into standard (0, 15, 30, 40, Ad)
  const formatPoints = (p: number, opp: number) => {
    if (p >= 3 && opp >= 3) {
      if (p === opp) return '40';
      if (p === opp + 1) return 'AD';
      if (opp === p + 1) return '40';
    }
    const scores = ['00', '15', '30', '40'];
    return scores[Math.min(3, p)];
  };

  // Convert game score text
  const getScoreSummary = useCallback(() => {
    if (playerPoints >= 3 && cpuPoints >= 3) {
      if (playerPoints === cpuPoints) return 'IGUAIS (DEUCE)';
      if (playerPoints > cpuPoints) return 'VANTAGEM VOCÊ (AD)';
      return 'VANTAGEM CPU (AD)';
    }
    return `${formatPoints(playerPoints, cpuPoints)} - ${formatPoints(cpuPoints, playerPoints)}`;
  }, [playerPoints, cpuPoints]);

  // Execute CPU Serve with authentic timing
  const executeCpuServe = useCallback((isDeuceSide: boolean) => {
    sound.playJump(); // toss sound

    // Serve target in diagonal service box
    const targetU = isDeuceSide ? -0.3 + (Math.random() - 0.5) * 0.3 : 0.3 + (Math.random() - 0.5) * 0.3;
    const targetV = 0.2 + Math.random() * 0.2; // Inside player's service box

    setTimeout(() => {
      const isAceAttempt = Math.random() < 0.25;
      const power = isAceAttempt ? 0.92 : 0.72;
      const speed = Math.round(135 + power * 55);

      ballRef.current.u = cpuRef.current.u;
      ballRef.current.v = -0.95;
      ballRef.current.z = 45;
      ballRef.current.lastHitter = 'CPU';
      ballRef.current.bouncesSinceHit = 0;
      ballRef.current.active = true;
      ballRef.current.speedKmh = speed;
      ballRef.current.spinType = Math.random() < 0.3 ? 'slice' : 'flat';

      // Velocity towards player service box
      const flightDuration = 48 - power * 14;
      ballRef.current.vu = (targetU - ballRef.current.u) / flightDuration;
      ballRef.current.vv = (targetV - ballRef.current.v) / flightDuration;
      ballRef.current.vz = 0.8; // arc

      sound.playTennisHit(power, ballRef.current.spinType);
      cpuRef.current.swingTimer = 14;
      setLastShotSpeed(speed);
      setLastShotType(ballRef.current.spinType);
      setAnnouncement(`SAQUE CPU: ${speed} km/h!`);
    }, 700);
  }, []);

  // Setup serve positioning based on score
  const setupNewServe = useCallback(() => {
    const totalPoints = playerPoints + cpuPoints;
    // Even total = Deuce court (right side), Odd total = Ad court (left side)
    const isDeuceSide = totalPoints % 2 === 0;
    const serveSideU = isDeuceSide ? 0.45 : -0.45;

    setServePhase('READY');
    setServeTossProgress(0);
    setRallyCount(0);

    if (currentServer === 'PLAYER') {
      playerRef.current.u = serveSideU;
      playerRef.current.v = 0.98;
      playerRef.current.targetU = serveSideU;
      playerRef.current.targetV = 0.98;

      // CPU positions diagonally
      cpuRef.current.u = isDeuceSide ? -0.45 : 0.45;
      cpuRef.current.v = -0.92;
      cpuRef.current.targetU = isDeuceSide ? -0.45 : 0.45;
      cpuRef.current.targetV = -0.92;

      // Ball in player's hand
      ballRef.current = {
        u: serveSideU,
        v: 0.98,
        z: 22,
        vu: 0,
        vv: 0,
        vz: 0,
        spinType: 'flat',
        spinU: 0,
        spinV: 0,
        lastHitter: 'NONE',
        bouncesSinceHit: 0,
        active: false,
        speedKmh: 0,
        trail: [],
      };
      setAnnouncement(serveFaultCount === 0 ? 'SEU SAQUE (1º Serviço) - Aperte ESPAÇO' : 'SEU SAQUE (2º Serviço)!');
    } else {
      // CPU serving
      cpuRef.current.u = serveSideU;
      cpuRef.current.v = -0.98;
      cpuRef.current.targetU = serveSideU;
      cpuRef.current.targetV = -0.98;

      playerRef.current.u = isDeuceSide ? -0.45 : 0.45;
      playerRef.current.v = 0.92;
      playerRef.current.targetU = isDeuceSide ? -0.45 : 0.45;
      playerRef.current.targetV = 0.92;

      ballRef.current = {
        u: serveSideU,
        v: -0.98,
        z: 22,
        vu: 0,
        vv: 0,
        vz: 0,
        spinType: 'flat',
        spinU: 0,
        spinV: 0,
        lastHitter: 'NONE',
        bouncesSinceHit: 0,
        active: false,
        speedKmh: 0,
        trail: [],
      };
      setAnnouncement('SAQUE DA CPU - PREPARE A DEVOLUÇÃO!');

      // CPU prepares serve
      setTimeout(() => {
        executeCpuServe(isDeuceSide);
      }, 1200);
    }
  }, [currentServer, playerPoints, cpuPoints, serveFaultCount, executeCpuServe]);

  // Point scoring resolution
  const handlePointEnd = useCallback((winner: 'PLAYER' | 'CPU', reason: string) => {
    ballRef.current.active = false;
    setGameState('POINT_PAUSE');

    if (winner === 'PLAYER') {
      sound.playTennisApplause();
      sound.playCoin();
      setAnnouncement(`PONTO SEU! (${reason})`);
    } else {
      sound.playTennisFault();
      setAnnouncement(`PONTO CPU! (${reason})`);
    }

    // Update Tennis Scores
    setPlayerPoints((currP) => {
      let nextP = currP;
      let nextCpu = cpuPoints;

      if (winner === 'PLAYER') nextP++;
      else nextCpu++;

      // Check Game Win
      let pGameWon = false;
      let cpuGameWon = false;

      if (nextP >= 4 && nextP >= nextCpu + 2) {
        pGameWon = true;
      } else if (nextCpu >= 4 && nextCpu >= nextP + 2) {
        cpuGameWon = true;
      }

      if (pGameWon) {
        sound.playLevelComplete();
        setPlayerGames((g) => {
          const updated = g + 1;
          if (updated >= matchLength) {
            setGameState('GAME_OVER');
            setAnnouncement('VITÓRIA NO GRAND SLAM! VOCÊ É O CAMPEÃO!');
            const newScore = Math.max(highScore, 1000 + updated * 500);
            saveHighScore('tennis', newScore);
            setHighScore(newScore);
            awardAuraWin('Grand Slam Tennis');
          } else {
            setAnnouncement(`GAME SEU! Placar: ${updated} - ${cpuGames}`);
          }
          return updated;
        });
        // Reset points and switch server
        setCpuPoints(0);
        setCurrentServer((s) => (s === 'PLAYER' ? 'CPU' : 'PLAYER'));
        setServeFaultCount(0);
        return 0;
      } else if (cpuGameWon) {
        sound.playGameOver();
        setCpuGames((g) => {
          const updated = g + 1;
          if (updated >= matchLength) {
            setGameState('GAME_OVER');
            setAnnouncement('FIM DE JOGO! CPU CONQUISTOU O TORNEIO!');
            triggerDefeat('Grand Slam Tennis');
          } else {
            setAnnouncement(`GAME CPU! Placar: ${playerGames} - ${updated}`);
          }
          return updated;
        });
        setCpuPoints(0);
        setCurrentServer((s) => (s === 'PLAYER' ? 'CPU' : 'PLAYER'));
        setServeFaultCount(0);
        return 0;
      }

      setCpuPoints(nextCpu);
      return nextP;
    });

    // Auto resume next point after 2.2 seconds
    setTimeout(() => {
      setGameState((st) => {
        if (st === 'GAME_OVER') return st;
        setupNewServe();
        return 'PLAYING';
      });
    }, 2200);
  }, [cpuPoints, cpuGames, playerGames, matchLength, setupNewServe, highScore]);

  // Player begins match
  const handleStartMatch = (courtKey?: CourtSurface) => {
    if (courtKey) setCourt(courtKey);
    setGameState('PLAYING');
    setPlayerPoints(0);
    setCpuPoints(0);
    setPlayerGames(0);
    setCpuGames(0);
    setCurrentServer('PLAYER');
    setServeFaultCount(0);
    setupNewServe();
    sound.playLevelComplete();
  };

  // Player hits the ball (Shot Physics with Power & Spin)
  const executePlayerShot = useCallback((powerRatio: number, spin: ShotType) => {
    const ball = ballRef.current;
    const player = playerRef.current;
    const courtConf = courtConfigRef.current;

    // Check distance to ball
    const distU = Math.abs(ball.u - player.u);
    const distV = Math.abs(ball.v - player.v);

    // Sweet Spot bonus: hit when power is between 0.75 and 0.95
    const isSweetSpot = powerRatio >= 0.75 && powerRatio <= 0.95;
    const effectivePower = isSweetSpot ? powerRatio * 1.15 : powerRatio;

    // Direct shot angle based on keys held (left/right aiming)
    let aimU = 0;
    if (keysDownRef.current['ArrowLeft'] || keysDownRef.current['a'] || keysDownRef.current['A']) {
      aimU = -0.65; // Crosscourt to left
    } else if (keysDownRef.current['ArrowRight'] || keysDownRef.current['d'] || keysDownRef.current['D']) {
      aimU = 0.65;  // Down the line to right
    } else {
      aimU = (Math.random() - 0.5) * 0.4; // Center
    }

    // Target depth based on power & spin
    // Topspin dips faster and lands safely deep; Slice floats; Flat flies straight
    let targetV = -0.7 - effectivePower * 0.22;
    if (spin === 'slice') targetV += 0.15; // Drops shorter
    if (spin === 'topspin') targetV -= 0.08; // Deep baseline kick

    // Calculate ball speeds
    const baseSpeed = spin === 'topspin' ? 145 : spin === 'slice' ? 120 : 160;
    const speed = Math.round(baseSpeed + effectivePower * 45);

    ball.u = player.u + (aimU > 0 ? 0.08 : -0.08);
    ball.v = player.v - 0.05;
    ball.z = Math.max(12, ball.z);
    ball.lastHitter = 'PLAYER';
    ball.bouncesSinceHit = 0;
    ball.active = true;
    ball.spinType = spin;
    ball.speedKmh = speed;

    // Ball flight velocity
    const flightTime = Math.max(26, 46 - effectivePower * 18);
    ball.vu = (aimU - ball.u) / flightTime;
    ball.vv = (targetV - ball.v) / flightTime;
    // Arc height: Topspin has arching height, Slice is low and flat
    ball.vz = spin === 'topspin' ? 2.6 : spin === 'slice' ? 1.3 : 1.9;

    // Spin physics
    ball.spinV = (spin === 'topspin' ? 1 : spin === 'slice' ? -1 : 0) * courtConf.spinMultiplier;
    ball.spinU = aimU * 0.5;

    // Visual & Sound Feedback
    player.swingTimer = 16;
    player.swingType = spin;
    sound.playTennisHit(effectivePower, spin);

    setLastShotSpeed(speed);
    setLastShotType(spin);
    setRallyCount((r) => r + 1);

    if (isSweetSpot) {
      setAnnouncement(`★ GOLPE PERFEITO (${spin.toUpperCase()}) - ${speed} km/h!`);
      // Golden impact sparkles
      for (let i = 0; i < 12; i++) {
        particlesRef.current.push({
          x: projectCourt(player.u, player.v).x,
          y: projectCourt(player.u, player.v).y - 20,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          color: '#facc15',
          alpha: 1,
          size: 4,
        });
      }
    } else {
      setAnnouncement(`${spin === 'topspin' ? '🌀 TOPSPIN' : spin === 'slice' ? '💨 SLICE' : '⚡ PLANO'} - ${speed} km/h`);
    }
  }, []);

  // Player initiates Serve Toss & Hit
  const handlePlayerServeAction = useCallback(() => {
    if (currentServer !== 'PLAYER') return;

    if (servePhase === 'READY') {
      // Step 1: Toss ball into the air
      setServePhase('TOSSING');
      serveTossStartRef.current = Date.now();
      sound.playJump();
      setAnnouncement('LANÇAMENTO! Aperte no ÁPICE (Verde) para um ACE!');

      ballRef.current.z = 15;
      ballRef.current.vz = 4.2; // Rises upwards in toss
    } else if (servePhase === 'TOSSING') {
      // Step 2: Hit serve at toss apex
      const tossAge = Date.now() - serveTossStartRef.current;
      // Ideal window is between 450ms and 750ms
      const isPerfectApex = tossAge >= 450 && tossAge <= 720;
      const isDecent = tossAge >= 320 && tossAge <= 900;

      if (!isDecent) {
        // Complete Miss or late hit
        sound.playTennisFault();
        setServeFaultCount((f) => {
          const next = f + 1;
          if (next >= 2) {
            handlePointEnd('CPU', 'DUPLA FALTA (Saque Errado)');
          } else {
            setAnnouncement('FALTA NO SAQUE! Você tem o 2º Serviço.');
            setupNewServe();
          }
          return next;
        });
        setServePhase('READY');
        return;
      }

      // Hit Serve!
      const totalPoints = playerPoints + cpuPoints;
      const isDeuceSide = totalPoints % 2 === 0;
      // Serve diagonally into CPU's service box
      const targetU = isDeuceSide ? -0.35 + (Math.random() - 0.5) * 0.25 : 0.35 + (Math.random() - 0.5) * 0.25;
      const targetV = -0.35 - (isPerfectApex ? 0.15 : 0.05);

      const power = isPerfectApex ? 0.95 : 0.75;
      const speed = Math.round(140 + power * 58);

      ballRef.current.u = playerRef.current.u;
      ballRef.current.v = 0.95;
      ballRef.current.z = 45;
      ballRef.current.lastHitter = 'PLAYER';
      ballRef.current.bouncesSinceHit = 0;
      ballRef.current.active = true;
      ballRef.current.speedKmh = speed;
      ballRef.current.spinType = selectedSpin;

      const flightDuration = 44 - power * 14;
      ballRef.current.vu = (targetU - ballRef.current.u) / flightDuration;
      ballRef.current.vv = (targetV - ballRef.current.v) / flightDuration;
      ballRef.current.vz = 0.8;

      playerRef.current.swingTimer = 16;
      sound.playTennisHit(power, selectedSpin);
      setServePhase('PLAY');
      setLastShotSpeed(speed);
      setLastShotType(selectedSpin);

      if (isPerfectApex) {
        sound.playTennisApplause();
        setAnnouncement(`🔥 BOMBA DE SAQUE! ACE A ${speed} km/h!`);
      } else {
        setAnnouncement(`SAQUE EM JOGO: ${speed} km/h`);
      }
    }
  }, [currentServer, servePhase, playerPoints, cpuPoints, selectedSpin, handlePointEnd, setupNewServe]);

  // Key Down: Start charging or toss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysDownRef.current[e.key] = true;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (gameState !== 'PLAYING') return;

      // Serve action
      if ((e.key === ' ' || e.key === 'Enter') && servePhase !== 'PLAY' && currentServer === 'PLAYER') {
        handlePlayerServeAction();
        return;
      }

      // Charge power for in-play groundstrokes
      if ((e.key === ' ' || e.key === 'j' || e.key === 'J') && !isCharging && servePhase === 'PLAY') {
        setIsCharging(true);
        setSelectedSpin('flat');
        chargeStartTimeRef.current = Date.now();
      } else if ((e.key === 'z' || e.key === 'k' || e.key === 'K') && !isCharging && servePhase === 'PLAY') {
        setIsCharging(true);
        setSelectedSpin('slice');
        chargeStartTimeRef.current = Date.now();
      } else if ((e.key === 'x' || e.key === 'l' || e.key === 'L') && !isCharging && servePhase === 'PLAY') {
        setIsCharging(true);
        setSelectedSpin('topspin');
        chargeStartTimeRef.current = Date.now();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDownRef.current[e.key] = false;

      // Release stroke
      if ([' ', 'j', 'J', 'z', 'k', 'K', 'x', 'l', 'L'].includes(e.key) && isCharging) {
        const duration = Date.now() - chargeStartTimeRef.current;
        // 0 to 1000ms charge = 0 to 100%
        const power = Math.min(1.0, Math.max(0.3, duration / 800));
        setIsCharging(false);
        setChargePower(0);
        executePlayerShot(power, selectedSpin);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, servePhase, currentServer, isCharging, selectedSpin, handlePlayerServeAction, executePlayerShot]);

  // Charging animation timer
  useEffect(() => {
    if (!isCharging) return;
    const interval = setInterval(() => {
      const duration = Date.now() - chargeStartTimeRef.current;
      setChargePower(Math.min(1.0, duration / 800));
    }, 30);
    return () => clearInterval(interval);
  }, [isCharging]);

  // Main 60 FPS Tennis Simulation & Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      updateSimulation();
      renderScene(ctx);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    const updateSimulation = () => {
      if (gameState !== 'PLAYING') return;

      const player = playerRef.current;
      const cpu = cpuRef.current;
      const ball = ballRef.current;
      const courtConf = courtConfigRef.current;

      // 1. Player Movement via keyboard
      const keys = keysDownRef.current;
      const speedU = 0.024;
      const speedV = 0.02;

      if (keys['ArrowLeft'] || keys['a'] || keys['A']) player.u = Math.max(-1.1, player.u - speedU);
      if (keys['ArrowRight'] || keys['d'] || keys['D']) player.u = Math.min(1.1, player.u + speedU);
      if (keys['ArrowUp'] || keys['w'] || keys['W']) player.v = Math.max(0.1, player.v - speedV);
      if (keys['ArrowDown'] || keys['s'] || keys['S']) player.v = Math.min(1.15, player.v + speedV);

      if (player.swingTimer > 0) player.swingTimer--;
      if (cpu.swingTimer > 0) cpu.swingTimer--;

      // 2. Serve Toss Animation
      if (servePhase === 'TOSSING' && currentServer === 'PLAYER') {
        const tossAge = Date.now() - serveTossStartRef.current;
        // Parabolic rise and fall
        const tossProgress = Math.min(1.0, tossAge / 1000);
        setServeTossProgress(tossProgress);

        ball.u = player.u;
        ball.v = player.v - 0.05;
        // Ball height peaks around 550ms
        ball.z = 20 + Math.sin(tossProgress * Math.PI) * 45;

        if (tossProgress >= 1.0) {
          // Missed serve
          handlePlayerServeAction();
        }
      }

      // 3. Ball Physics & 3D Flight
      if (ball.active) {
        // Record trail
        const screenPos = projectCourt(ball.u, ball.v);
        ball.trail.push({
          x: screenPos.x,
          y: screenPos.y - ball.z * 0.9,
          alpha: 0.6,
          color: ball.spinType === 'topspin' ? '#f97316' : ball.spinType === 'slice' ? '#38bdf8' : '#facc15',
        });
        if (ball.trail.length > 8) ball.trail.shift();

        // Integrate positions
        ball.u += ball.vu;
        ball.v += ball.vv;
        ball.z += ball.vz;

        // Gravity & Magnus Effect (Spins)
        // Topspin accelerates downward dive; Slice floats with lift!
        const gravity = 0.14;
        const magnusZ = ball.spinV * 0.04;
        ball.vz -= gravity + magnusZ;

        // Sidespin curves U
        ball.vu += ball.spinU * 0.0015;

        // Check Net Collision (Y=305 is net line, v=0)
        // Net height is ~18 units in 3D
        if (Math.abs(ball.v) < 0.03 && ball.z < 18) {
          // Hit the net!
          sound.playBounce();
          ball.active = false;
          const winner = ball.lastHitter === 'PLAYER' ? 'CPU' : 'PLAYER';
          handlePointEnd(winner, 'NA REDE!');
          return;
        }

        // Ground Bounce Detection (z <= 0)
        if (ball.z <= 0) {
          ball.z = 0;
          ball.bouncesSinceHit++;
          sound.playTennisBounce(courtConf.id);

          // Spawn court impact dust
          for (let i = 0; i < 6; i++) {
            particlesRef.current.push({
              x: screenPos.x,
              y: screenPos.y,
              vx: (Math.random() - 0.5) * 3,
              vy: (Math.random() - 0.5) * 2,
              color: courtConf.dustColor,
              alpha: 0.8,
              size: 3,
            });
          }

          // Check if ball bounced OUT on 1st bounce
          if (ball.bouncesSinceHit === 1) {
            const isOutWidth = Math.abs(ball.u) > 0.88;
            const isOutBaseline = Math.abs(ball.v) > 1.05;

            if (isOutWidth || isOutBaseline) {
              // OUT!
              const winner = ball.lastHitter === 'PLAYER' ? 'CPU' : 'PLAYER';
              handlePointEnd(winner, 'BOLA FORA!');
              return;
            }
          }

          // Double Bounce = Winner
          if (ball.bouncesSinceHit >= 2) {
            ball.active = false;
            const winner = ball.lastHitter === 'PLAYER' ? 'PLAYER' : 'CPU';
            handlePointEnd(winner, winner === 'PLAYER' ? 'WINNER SEU! (Dois Quiques)' : 'PONTO CPU (Dois Quiques)');
            return;
          }

          // Calculate bounce rebound based on surface restitution & friction
          ball.vz = Math.abs(ball.vz) * courtConf.restitution;
          ball.vv *= courtConf.friction;
          ball.vu *= courtConf.friction;

          // Topspin kick: accelerates forward! Slice skids: stays low
          if (ball.spinType === 'topspin') {
            ball.vv *= 1.15;
            ball.vz *= 1.1;
          } else if (ball.spinType === 'slice') {
            ball.vz *= 0.65; // very low skid!
          }
        }
      }

      // 4. Smart CPU AI Logic
      if (ball.active && ball.vv < 0) {
        // Ball heading towards CPU side
        // CPU predicts arrival U coordinate
        const targetU = Math.max(-0.85, Math.min(0.85, ball.u + ball.vu * 6));
        const diffU = targetU - cpu.u;
        cpu.u += Math.sign(diffU) * Math.min(Math.abs(diffU), 0.022);

        // CPU positions in court depth
        const targetV = -0.85;
        const diffV = targetV - cpu.v;
        cpu.v += Math.sign(diffV) * Math.min(Math.abs(diffV), 0.015);

        // CPU Hit Check
        const distU = Math.abs(ball.u - cpu.u);
        const distV = Math.abs(ball.v - cpu.v);

        if (distU < 0.28 && distV < 0.22 && ball.z > 5 && ball.z < 45 && ball.lastHitter !== 'CPU') {
          // CPU strikes back!
          const cpuPower = 0.65 + Math.random() * 0.28;
          const spinChoice: ShotType = Math.random() < 0.4 ? 'topspin' : Math.random() < 0.7 ? 'flat' : 'slice';
          const aimU = player.u > 0 ? -0.55 + (Math.random() - 0.5) * 0.3 : 0.55 + (Math.random() - 0.5) * 0.3;
          const speed = Math.round(130 + cpuPower * 45);

          ball.lastHitter = 'CPU';
          ball.bouncesSinceHit = 0;
          ball.spinType = spinChoice;
          ball.speedKmh = speed;

          const flight = 45 - cpuPower * 14;
          ball.vu = (aimU - ball.u) / flight;
          ball.vv = (0.75 - ball.v) / flight; // Towards player baseline
          ball.vz = spinChoice === 'topspin' ? 2.4 : spinChoice === 'slice' ? 1.4 : 1.8;

          sound.playTennisHit(cpuPower, spinChoice);
          cpu.swingTimer = 16;
          setLastShotSpeed(speed);
          setLastShotType(spinChoice);
          setRallyCount((r) => r + 1);
          setAnnouncement(`CPU RESPONDEU COM ${spinChoice.toUpperCase()}! (${speed} km/h)`);
        }
      } else if (!ball.active && gameState === 'PLAYING') {
        // Return to center baseline
        cpu.u += (0 - cpu.u) * 0.05;
        cpu.v += (-0.9 - cpu.v) * 0.05;
      }

      // Update Particles
      particlesRef.current = particlesRef.current
        .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, alpha: p.alpha - 0.04 }))
        .filter((p) => p.alpha > 0);
    };

    // Render 3D Perspective Tennis Court
    const renderScene = (c: CanvasRenderingContext2D) => {
      const courtConf = courtConfigRef.current;
      c.save();

      // Outer Stadium / Crowd Area
      c.fillStyle = courtConf.outerColor;
      c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Stadium Spectators at top
      c.fillStyle = '#0f172a';
      c.fillRect(0, 0, CANVAS_WIDTH, 80);
      // Animated crowd flashes
      c.fillStyle = '#334155';
      for (let x = 12; x < CANVAS_WIDTH; x += 14) {
        for (let y = 14; y < 65; y += 12) {
          c.fillRect(x, y, 7, 7);
          if (Math.random() < 0.008) {
            c.fillStyle = '#f8fafc';
            c.fillRect(x, y, 9, 9); // camera flash!
            c.fillStyle = '#334155';
          }
        }
      }

      // Main Inner Tennis Court (Trapezoid Perspective)
      const pTopLeft = projectCourt(-1.0, -1.0);
      const pTopRight = projectCourt(1.0, -1.0);
      const pBottomRight = projectCourt(1.0, 1.0);
      const pBottomLeft = projectCourt(-1.0, 1.0);

      c.beginPath();
      c.moveTo(pTopLeft.x - 20, pTopLeft.y - 15);
      c.lineTo(pTopRight.x + 20, pTopRight.y - 15);
      c.lineTo(pBottomRight.x + 35, pBottomRight.y + 25);
      c.lineTo(pBottomLeft.x - 35, pBottomLeft.y + 25);
      c.closePath();
      c.fillStyle = courtConf.innerColor;
      c.fill();

      // Grass Mowed Lawn Stripes (if Grass court)
      if (courtConf.id === 'grama') {
        c.save();
        c.clip();
        for (let v = -1.0; v <= 1.0; v += 0.25) {
          const p1 = projectCourt(-1.2, v);
          const p2 = projectCourt(1.2, v);
          const p3 = projectCourt(1.2, v + 0.125);
          const p4 = projectCourt(-1.2, v + 0.125);
          c.fillStyle = 'rgba(255, 255, 255, 0.06)';
          c.beginPath();
          c.moveTo(p1.x, p1.y);
          c.lineTo(p2.x, p2.y);
          c.lineTo(p3.x, p3.y);
          c.lineTo(p4.x, p4.y);
          c.closePath();
          c.fill();
        }
        c.restore();
      }

      // Draw Tennis Lines
      c.strokeStyle = courtConf.lineColor;
      c.lineWidth = 2.5;

      // 1. Singles Sidelines (u = -0.82 and u = 0.82)
      const pS1 = projectCourt(-0.82, -1.0);
      const pS2 = projectCourt(-0.82, 1.0);
      c.beginPath();
      c.moveTo(pS1.x, pS1.y);
      c.lineTo(pS2.x, pS2.y);
      c.stroke();

      const pS3 = projectCourt(0.82, -1.0);
      const pS4 = projectCourt(0.82, 1.0);
      c.beginPath();
      c.moveTo(pS3.x, pS3.y);
      c.lineTo(pS4.x, pS4.y);
      c.stroke();

      // 2. Baselines (v = -1.0 and v = 1.0)
      c.beginPath();
      c.moveTo(pTopLeft.x, pTopLeft.y);
      c.lineTo(pTopRight.x, pTopRight.y);
      c.stroke();

      c.beginPath();
      c.moveTo(pBottomLeft.x, pBottomLeft.y);
      c.lineTo(pBottomRight.x, pBottomRight.y);
      c.stroke();

      // 3. Service Lines (v = -0.48 and v = 0.48)
      const pServTopL = projectCourt(-0.82, -0.48);
      const pServTopR = projectCourt(0.82, -0.48);
      c.beginPath();
      c.moveTo(pServTopL.x, pServTopL.y);
      c.lineTo(pServTopR.x, pServTopR.y);
      c.stroke();

      const pServBotL = projectCourt(-0.82, 0.48);
      const pServBotR = projectCourt(0.82, 0.48);
      c.beginPath();
      c.moveTo(pServBotL.x, pServBotL.y);
      c.lineTo(pServBotR.x, pServBotR.y);
      c.stroke();

      // 4. Center Service Line (u = 0 from v = -0.48 to +0.48)
      const pCenterTop = projectCourt(0, -0.48);
      const pCenterBot = projectCourt(0, 0.48);
      c.beginPath();
      c.moveTo(pCenterTop.x, pCenterTop.y);
      c.lineTo(pCenterBot.x, pCenterBot.y);
      c.stroke();

      // 5. Center Hash Marks on baselines
      const pMarkTop = projectCourt(0, -1.0);
      const pMarkTopIn = projectCourt(0, -0.95);
      c.beginPath();
      c.moveTo(pMarkTop.x, pMarkTop.y);
      c.lineTo(pMarkTopIn.x, pMarkTopIn.y);
      c.stroke();

      const pMarkBot = projectCourt(0, 1.0);
      const pMarkBotIn = projectCourt(0, 0.95);
      c.beginPath();
      c.moveTo(pMarkBot.x, pMarkBot.y);
      c.lineTo(pMarkBotIn.x, pMarkBotIn.y);
      c.stroke();

      // 6. Draw CPU Player
      renderPlayer(c, cpuRef.current, false);

      // 7. Tennis Net (v = 0)
      const pNetL = projectCourt(-1.08, 0);
      const pNetR = projectCourt(1.08, 0);
      const netHeight = 22;

      // Net Mesh
      c.fillStyle = 'rgba(255, 255, 255, 0.4)';
      c.fillRect(pNetL.x, pNetL.y - netHeight, pNetR.x - pNetL.x, netHeight);

      // Net Posts
      c.fillStyle = '#0f172a';
      c.fillRect(pNetL.x - 4, pNetL.y - netHeight - 4, 6, netHeight + 6);
      c.fillRect(pNetR.x - 2, pNetR.y - netHeight - 4, 6, netHeight + 6);

      // White Net Band top strap
      c.fillStyle = '#ffffff';
      c.fillRect(pNetL.x, pNetL.y - netHeight, pNetR.x - pNetL.x, 3.5);
      // Center strap
      const pNetCenter = projectCourt(0, 0);
      c.fillRect(pNetCenter.x - 2, pNetCenter.y - netHeight, 4, netHeight);

      // 8. Draw Player (Felix/Mac style athlete with racket)
      renderPlayer(c, playerRef.current, true);

      // 9. Ball Trail & 3D Ball
      const ball = ballRef.current;
      if (ball.active || servePhase === 'TOSSING') {
        const bPos = projectCourt(ball.u, ball.v);

        // Draw Trails
        ball.trail.forEach((t, idx) => {
          c.save();
          c.globalAlpha = t.alpha * ((idx + 1) / ball.trail.length);
          c.fillStyle = t.color;
          c.beginPath();
          c.arc(t.x, t.y, 4, 0, Math.PI * 2);
          c.fill();
          c.restore();
        });

        // Ball Shadow on Court Ground
        const shadowScale = Math.max(0.3, 1 - ball.z / 90);
        c.fillStyle = 'rgba(0, 0, 0, 0.45)';
        c.beginPath();
        c.ellipse(bPos.x, bPos.y, 7 * shadowScale, 3.5 * shadowScale, 0, 0, Math.PI * 2);
        c.fill();

        // Ball in Air (y offset by z)
        const ballScreenY = bPos.y - ball.z * 0.9;
        const ballRadius = Math.max(4, 5.5 + ball.z * 0.04);

        // Glowing Spin Aura
        c.save();
        if (ball.spinType === 'topspin') {
          c.shadowColor = '#f97316';
          c.shadowBlur = 12;
        } else if (ball.spinType === 'slice') {
          c.shadowColor = '#38bdf8';
          c.shadowBlur = 12;
        } else if (ball.speedKmh > 165) {
          c.shadowColor = '#facc15';
          c.shadowBlur = 16;
        }

        // Tennis Yellow Ball
        const bGrad = c.createRadialGradient(
          bPos.x - 2,
          ballScreenY - 2,
          1,
          bPos.x,
          ballScreenY,
          ballRadius
        );
        bGrad.addColorStop(0, '#fef08a');
        bGrad.addColorStop(0.7, '#eab308');
        bGrad.addColorStop(1, '#ca8a04');
        c.fillStyle = bGrad;
        c.beginPath();
        c.arc(bPos.x, ballScreenY, ballRadius, 0, Math.PI * 2);
        c.fill();

        // White curved ball seam line
        c.strokeStyle = '#f8fafc';
        c.lineWidth = 1;
        c.beginPath();
        c.arc(bPos.x, ballScreenY, ballRadius * 0.75, 0.4, 2.8);
        c.stroke();
        c.restore();
      }

      // 10. Particles
      particlesRef.current.forEach((p) => {
        c.save();
        c.globalAlpha = p.alpha;
        c.fillStyle = p.color;
        c.fillRect(p.x, p.y, p.size, p.size);
        c.restore();
      });

      // 11. In-game Power Meter over Player
      if (isCharging) {
        const pPos = projectCourt(playerRef.current.u, playerRef.current.v);
        const barW = 60;
        const barH = 7;
        const barX = pPos.x - barW / 2;
        const barY = pPos.y + 24;

        // Background
        c.fillStyle = 'rgba(15, 23, 42, 0.85)';
        c.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

        // Power Fill Gradient
        const fillW = barW * chargePower;
        const pGrad = c.createLinearGradient(barX, 0, barX + barW, 0);
        pGrad.addColorStop(0, '#38bdf8');
        pGrad.addColorStop(0.7, '#facc15');
        pGrad.addColorStop(0.85, '#22c55e'); // Golden Sweet spot
        pGrad.addColorStop(1, '#ef4444');

        c.fillStyle = pGrad;
        c.fillRect(barX, barY, fillW, barH);

        // Sweet Spot Mark (75% to 92%)
        c.fillStyle = '#ffffff';
        c.fillRect(barX + barW * 0.75, barY - 2, 2, barH + 4);
        c.fillRect(barX + barW * 0.92, barY - 2, 2, barH + 4);
      }

      // 12. Serve Toss Apex Sweet Spot Indicator
      if (servePhase === 'TOSSING' && currentServer === 'PLAYER') {
        const pPos = projectCourt(playerRef.current.u, playerRef.current.v);
        c.save();
        c.fillStyle = serveTossProgress >= 0.5 && serveTossProgress <= 0.8 ? '#22c55e' : '#facc15';
        c.font = 'bold 11px monospace';
        c.textAlign = 'center';
        c.fillText('APERTE ESPAÇO NO ÁPICE!', pPos.x, pPos.y - 75);
        c.restore();
      }

      c.restore();
    };

    // Render 3D Sprite Tennis Player
    const renderPlayer = (
      c: CanvasRenderingContext2D,
      player: { u: number; v: number; swingTimer: number; swingType: ShotType },
      isBottom: boolean
    ) => {
      const pos = projectCourt(player.u, player.v);
      const scale = isBottom ? 1.0 : 0.65;

      c.save();
      c.translate(pos.x, pos.y);
      c.scale(scale, scale);

      // Player Shadow
      c.fillStyle = 'rgba(0, 0, 0, 0.4)';
      c.beginPath();
      c.ellipse(0, 2, 14, 5, 0, 0, Math.PI * 2);
      c.fill();

      // Traditional Wimbledon/Arcade Player Colors
      const shirtColor = isBottom ? '#2563eb' : '#dc2626'; // Blue vs Red
      const shortsColor = '#f8fafc'; // Crisp athletic white

      // Legs / Tennis Shoes
      c.fillStyle = '#f8fafc';
      c.fillRect(-8, -12, 5, 12);
      c.fillRect(3, -12, 5, 12);
      // Shoes
      c.fillStyle = '#0f172a';
      c.fillRect(-9, -2, 6, 4);
      c.fillRect(3, -2, 6, 4);

      // Shorts
      c.fillStyle = shortsColor;
      c.fillRect(-9, -20, 18, 10);

      // Torso / Athletic Polo Shirt
      c.fillStyle = shirtColor;
      c.fillRect(-10, -36, 20, 18);
      // White collar
      c.fillStyle = '#ffffff';
      c.fillRect(-4, -36, 8, 4);

      // Head & Tennis Headband
      c.fillStyle = '#fbcfe8'; // Skin
      c.fillRect(-6, -48, 12, 12);
      // Headband
      c.fillStyle = isBottom ? '#facc15' : '#ffffff';
      c.fillRect(-7, -46, 14, 3);
      // Hair
      c.fillStyle = '#78350f';
      c.fillRect(-7, -51, 14, 5);

      // TENNIS RACKET & SWING
      c.save();
      const isSwinging = player.swingTimer > 0;
      const swingAngle = isSwinging ? (isBottom ? -0.9 : 0.9) : 0.2;
      c.rotate(swingAngle);

      // Arm
      c.fillStyle = '#fbcfe8';
      c.fillRect(8, -32, 10, 5);

      // Racket Shaft & Grip
      c.fillStyle = '#0f172a';
      c.fillRect(16, -33, 14, 3);

      // Racket Head / Frame (Graphite Neon)
      c.strokeStyle = isBottom ? '#f59e0b' : '#38bdf8';
      c.lineWidth = 2.5;
      c.strokeRect(30, -41, 16, 20);

      // String Pattern
      c.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(34, -41);
      c.lineTo(34, -21);
      c.moveTo(42, -41);
      c.lineTo(42, -21);
      c.moveTo(30, -31);
      c.lineTo(46, -31);
      c.stroke();
      c.restore();

      c.restore();
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState, servePhase, currentServer, isCharging, chargePower, serveTossProgress, handlePlayerServeAction, handlePointEnd]);

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto font-sans select-none">
      {/* RETRO SCOREBOARD & TOURNAMENT HUD */}
      <div className="w-full bg-[#2a1144] border border-[#7e3bbd]/70 rounded-t-2xl p-3 flex flex-col gap-2.5 shadow-xl">
        <div className="flex items-center justify-between">
          {/* Surface & Location Info */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎾</span>
            <div>
              <div className="font-black text-[#00f5ff] text-xs sm:text-sm tracking-wide flex items-center gap-2 neon-text-glow">
                <span>GRAND SLAM MASTERS</span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase"
                  style={{
                    backgroundColor: currentCourtConfig.innerColor + '33',
                    color: currentCourtConfig.lineColor,
                  }}
                >
                  {currentCourtConfig.name}
                </span>
              </div>
              <div className="text-[10px] text-[#a5f3fc] font-mono flex items-center gap-2">
                <span>{currentCourtConfig.location}</span>
                {rallyCount > 0 && (
                  <span className="text-[#00f5ff] font-bold">Rali: {rallyCount} trocas</span>
                )}
              </div>
            </div>
          </div>

          {/* Official Tennis Scoreboard Box */}
          <div className="bg-[#1c0830] border border-[#7e3bbd]/60 rounded-lg px-2.5 py-1.5 flex items-center gap-3 font-mono shadow-inner">
            {/* Player */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                {currentServer === 'PLAYER' && <span className="text-[9px] text-[#00f5ff]">🎾</span>}
                <span className="text-[10px] font-bold text-[#00f5ff]">VOCÊ</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-black text-emerald-400">{playerGames}</span>
                <span className="text-sm font-black text-[#00f5ff]">{formatPoints(playerPoints, cpuPoints)}</span>
              </div>
            </div>

            <div className="text-[#7e3bbd] font-bold text-xs">:</div>

            {/* CPU */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                {currentServer === 'CPU' && <span className="text-[9px] text-[#00f5ff]">🎾</span>}
                <span className="text-[10px] font-bold text-[#a5f3fc]">CPU</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-black text-emerald-400">{cpuGames}</span>
                <span className="text-sm font-black text-slate-300">{formatPoints(cpuPoints, playerPoints)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Radar Speed Gun & Announcement Banner */}
        <div className="flex items-center justify-between text-xs px-2.5 py-1 bg-slate-950/80 rounded-lg border border-slate-800 font-mono">
          <div className="flex items-center gap-2 truncate">
            <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] text-slate-300 truncate">{announcement}</span>
          </div>
          {lastShotSpeed > 0 && (
            <div className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-amber-400 pl-2">
              <span>⚡ {lastShotSpeed} km/h</span>
              <span className="text-[9px] text-slate-400">({lastShotType.toUpperCase()})</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Tennis Court Canvas */}
      <div className="relative w-full aspect-[520/620] max-h-[620px] bg-slate-950 border-x border-slate-800 overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full block"
        />

        {/* Start Menu / Court Selection Screen */}
        {gameState === 'MENU' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 overflow-y-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/20 text-3xl">
              🎾
            </div>
            <h3 className="text-2xl font-black text-white mb-1">Grand Slam Tennis Masters</h3>
            <p className="text-xs text-emerald-400 font-mono mb-4 tracking-widest uppercase">
              Escolha a Quadra do Torneio
            </p>

            {/* 3 Courts Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-md mb-5">
              {(Object.keys(COURTS) as CourtSurface[]).map((key) => {
                const cConf = COURTS[key];
                const isSelected = court === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCourt(key)}
                    className={`p-3 rounded-xl border flex flex-col items-start text-left transition-all ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-500/15 shadow-md shadow-emerald-500/20'
                        : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-black text-white">{cConf.name}</span>
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-white/40"
                        style={{ backgroundColor: cConf.innerColor }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono mb-2">{cConf.location}</span>
                    <div className="text-[9px] font-mono text-emerald-300/90 space-y-0.5">
                      <div>{cConf.speedRating}</div>
                      <div>{cConf.bounceRating}</div>
                      <div>{cConf.spinRating}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Match Length Selector */}
            <div className="flex items-center gap-3 mb-5 font-mono text-xs">
              <span className="text-slate-400">Duração:</span>
              <button
                type="button"
                onClick={() => setMatchLength(1)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                  matchLength === 1
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                    : 'border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                1 Game Rápido
              </button>
              <button
                type="button"
                onClick={() => setMatchLength(3)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                  matchLength === 3
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                    : 'border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Melhor de 3 Games (Set)
              </button>
            </div>

            <button
              onClick={() => handleStartMatch()}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 active:scale-95 transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Entrar em Quadra (Jogar)
            </button>
          </div>
        )}

        {/* Game Over / Tournament Winner Screen */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="text-5xl mb-2 animate-bounce">🏆 🍾 🎾</div>
            <div className="text-xs text-amber-400 font-mono tracking-widest uppercase font-bold mb-1">
              FIM DA PARTIDA
            </div>
            <h3 className="text-2xl font-black text-white mb-2">
              {playerGames > cpuGames ? 'Você Venceu o Grand Slam!' : 'CPU Conquistou o Título!'}
            </h3>
            <p className="text-xs text-slate-300 mb-6 font-mono">
              Placar Final: <span className="text-emerald-400 font-bold">{playerGames}</span> -{' '}
              <span className="text-slate-400">{cpuGames}</span> ({currentCourtConfig.name})
            </p>
            <button
              onClick={() => setGameState('MENU')}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Jogar Novamente / Mudar Quadra
            </button>
          </div>
        )}
      </div>

      {/* TACTILE ARCADE CONTROLS: POWER REGULATOR & SPIN SELECTOR */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-b-2xl p-3 flex flex-col gap-3">
        {/* Surface Quick Switch Tabs */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Quadra:</span>
          <div className="flex items-center gap-1.5">
            {(['concreto', 'saibro', 'grama'] as CourtSurface[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setCourt(key);
                  sound.playClick();
                }}
                className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
                  court === key
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {COURTS[key].name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Power Regulator & Live Shot Gauge */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          {/* Power Meter Gauge & Mobile Movement D-Pad */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                REGULADOR DE FORÇA
              </span>
              <span className="font-bold text-amber-400">
                {Math.round(chargePower * 100)}%
                {chargePower >= 0.75 && chargePower <= 0.95 && ' ★ SWEET SPOT'}
              </span>
            </div>

            {/* Animated Gauge Bar */}
            <div className="relative w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-amber-400 via-emerald-400 to-rose-500 transition-all duration-75"
                style={{ width: `${chargePower * 100}%` }}
              />
              {/* Sweet spot marker line */}
              <div className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-white/70" />
              <div className="absolute top-0 bottom-0 left-[92%] w-0.5 bg-white/70" />
            </div>
            <div className="flex justify-between text-[8px] font-mono text-slate-500">
              <span>0% Curto</span>
              <span className="text-emerald-400">75%-92% Perfeito</span>
              <span className="text-rose-400">100% Risco</span>
            </div>

            {/* Mobile Movement D-Pad */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[9px] font-mono text-slate-400">MOVIMENTO:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onMouseDown={() => { keysDownRef.current['ArrowLeft'] = true; }}
                  onMouseUp={() => { keysDownRef.current['ArrowLeft'] = false; }}
                  onTouchStart={() => { keysDownRef.current['ArrowLeft'] = true; }}
                  onTouchEnd={() => { keysDownRef.current['ArrowLeft'] = false; }}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center transition-colors"
                  title="Esquerda"
                >
                  ◀
                </button>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onMouseDown={() => { keysDownRef.current['ArrowUp'] = true; }}
                    onMouseUp={() => { keysDownRef.current['ArrowUp'] = false; }}
                    onTouchStart={() => { keysDownRef.current['ArrowUp'] = true; }}
                    onTouchEnd={() => { keysDownRef.current['ArrowUp'] = false; }}
                    className="w-8 h-4 rounded-t-md bg-slate-800 hover:bg-slate-700 active:bg-emerald-500 text-white font-bold text-[9px] flex items-center justify-center transition-colors"
                    title="Avançar para Rede"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onMouseDown={() => { keysDownRef.current['ArrowDown'] = true; }}
                    onMouseUp={() => { keysDownRef.current['ArrowDown'] = false; }}
                    onTouchStart={() => { keysDownRef.current['ArrowDown'] = true; }}
                    onTouchEnd={() => { keysDownRef.current['ArrowDown'] = false; }}
                    className="w-8 h-4 rounded-b-md bg-slate-800 hover:bg-slate-700 active:bg-emerald-500 text-white font-bold text-[9px] flex items-center justify-center transition-colors"
                    title="Recuar Fundo"
                  >
                    ▼
                  </button>
                </div>
                <button
                  type="button"
                  onMouseDown={() => { keysDownRef.current['ArrowRight'] = true; }}
                  onMouseUp={() => { keysDownRef.current['ArrowRight'] = false; }}
                  onTouchStart={() => { keysDownRef.current['ArrowRight'] = true; }}
                  onTouchEnd={() => { keysDownRef.current['ArrowRight'] = false; }}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center transition-colors"
                  title="Direita"
                >
                  ▶
                </button>
              </div>
            </div>
          </div>

          {/* Action Stroke Buttons (Flat, Topspin, Slice, Serve) */}
          <div className="grid grid-cols-3 gap-2">
            {/* Topspin Button */}
            <button
              type="button"
              onMouseDown={() => {
                setIsCharging(true);
                setSelectedSpin('topspin');
                chargeStartTimeRef.current = Date.now();
              }}
              onMouseUp={() => {
                if (isCharging) {
                  const duration = Date.now() - chargeStartTimeRef.current;
                  const power = Math.min(1.0, Math.max(0.3, duration / 800));
                  setIsCharging(false);
                  setChargePower(0);
                  executePlayerShot(power, 'topspin');
                }
              }}
              onTouchStart={() => {
                setIsCharging(true);
                setSelectedSpin('topspin');
                chargeStartTimeRef.current = Date.now();
              }}
              onTouchEnd={() => {
                if (isCharging) {
                  const duration = Date.now() - chargeStartTimeRef.current;
                  const power = Math.min(1.0, Math.max(0.3, duration / 800));
                  setIsCharging(false);
                  setChargePower(0);
                  executePlayerShot(power, 'topspin');
                }
              }}
              className="py-3 px-2 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/40 text-orange-300 font-mono font-bold text-xs flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all"
            >
              <span className="text-base">🌀</span>
              <span>TOPSPIN</span>
              <span className="text-[8px] opacity-70">(X / L)</span>
            </button>

            {/* Flat Power Stroke / Serve */}
            <button
              type="button"
              onClick={() => {
                if (servePhase !== 'PLAY' && currentServer === 'PLAYER') {
                  handlePlayerServeAction();
                }
              }}
              onMouseDown={() => {
                if (servePhase === 'PLAY') {
                  setIsCharging(true);
                  setSelectedSpin('flat');
                  chargeStartTimeRef.current = Date.now();
                }
              }}
              onMouseUp={() => {
                if (servePhase === 'PLAY' && isCharging) {
                  const duration = Date.now() - chargeStartTimeRef.current;
                  const power = Math.min(1.0, Math.max(0.3, duration / 800));
                  setIsCharging(false);
                  setChargePower(0);
                  executePlayerShot(power, 'flat');
                }
              }}
              onTouchStart={() => {
                if (servePhase === 'PLAY') {
                  setIsCharging(true);
                  setSelectedSpin('flat');
                  chargeStartTimeRef.current = Date.now();
                }
              }}
              onTouchEnd={() => {
                if (servePhase === 'PLAY' && isCharging) {
                  const duration = Date.now() - chargeStartTimeRef.current;
                  const power = Math.min(1.0, Math.max(0.3, duration / 800));
                  setIsCharging(false);
                  setChargePower(0);
                  executePlayerShot(power, 'flat');
                }
              }}
              className="py-3 px-2 rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
            >
              <span className="text-base">⚡</span>
              <span>{servePhase !== 'PLAY' && currentServer === 'PLAYER' ? 'SAQUE!' : 'PLANO'}</span>
              <span className="text-[8px] font-mono opacity-80">(Espaço)</span>
            </button>

            {/* Slice / Cortada Button */}
            <button
              type="button"
              onMouseDown={() => {
                setIsCharging(true);
                setSelectedSpin('slice');
                chargeStartTimeRef.current = Date.now();
              }}
              onMouseUp={() => {
                if (isCharging) {
                  const duration = Date.now() - chargeStartTimeRef.current;
                  const power = Math.min(1.0, Math.max(0.3, duration / 800));
                  setIsCharging(false);
                  setChargePower(0);
                  executePlayerShot(power, 'slice');
                }
              }}
              onTouchStart={() => {
                setIsCharging(true);
                setSelectedSpin('slice');
                chargeStartTimeRef.current = Date.now();
              }}
              onTouchEnd={() => {
                if (isCharging) {
                  const duration = Date.now() - chargeStartTimeRef.current;
                  const power = Math.min(1.0, Math.max(0.3, duration / 800));
                  setIsCharging(false);
                  setChargePower(0);
                  executePlayerShot(power, 'slice');
                }
              }}
              className="py-3 px-2 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 font-mono font-bold text-xs flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all"
            >
              <span className="text-base">💨</span>
              <span>SLICE</span>
              <span className="text-[8px] opacity-70">(Z / K)</span>
            </button>
          </div>
        </div>

        {/* Footer Info & Instructions */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800 font-mono">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Recorde: {highScore.toLocaleString('pt-BR')} pts</span>
          </div>

          <div className="text-[10px] text-slate-500">
            Física 3D: Efeito Magnus + Quique Realista
          </div>
        </div>
      </div>
    </div>
  );
}
