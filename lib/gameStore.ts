export type GameId = 'figura_historica' | 'tennis' | 'detona_ralph' | 'punch_out' | 'sinuca' | 'snake' | 'tetris' | 'invaders' | 'breakout' | 'minesweeper' | 'pong' | 'donkey_kong' | 'soletrando' | 'pinball';

export interface GameInfo {
  id: GameId;
  title: string;
  subtitle: string;
  year: string;
  genre: 'Arcade' | 'Puzzle' | 'Ação' | 'Mesa' | 'Luta' | 'Esportes';
  players: string;
  description: string;
  coverImage: string;
  accentColor: string; // Tailwind color token or hex
  accentBg: string;
  instructions: {
    keyboard: string[];
    mobile: string;
    goal: string;
  };
}

export const GAMES_CATALOG: GameInfo[] = [
  {
    id: 'figura_historica',
    title: 'Quem Sou Eu? Enigma Histórico',
    subtitle: 'Faça perguntas de Sim e Não para desvendar a figura histórica!',
    year: '2024 / Retro Quiz',
    genre: 'Puzzle',
    players: '1 Jogador vs Oráculo Histórico',
    coverImage: '/assets/images/history_cover_1790633352106.jpg',
    description: 'Um enigma mental fascinante! Uma figura histórica marcante de qualquer área (Ciências, Artes, Liderança Política, Filosofia ou Exploração) foi mantida sob sigilo no arquivo confidencial. Faça perguntas estratégicas de SIM ou NÃO para deduzir sua identidade, desbloqueie pistas secretas se precisar de auxílio, e tente arriscar o palpite no menor número de rodadas para bater o recorde!',
    accentColor: '#f59e0b',
    accentBg: 'from-amber-950/40 to-slate-900',
    instructions: {
      keyboard: [
        'Digite perguntas no campo de texto e pressione Enter para consultar o oráculo',
        'Use perguntas de SIM ou NÃO (ex: "Viveu no século XX?", "Ganhou um Nobel?", "Era mulher?")',
        'Clique nos atalhos rápidos de perguntas para acelerar sua investigação',
        'Clique em "🎯 ARRISCAR QUEM É!" quando tiver certeza da identidade histórica',
        'Desbloqueie até 3 Pistas Históricas secretas caso fique preso',
      ],
      mobile: 'Digite suas perguntas ou toque nos botões de perguntas rápidas recomendadas. Toque em "Arriscar Quem É" para enviar seu palpite.',
      goal: 'Descubra a figura histórica misteriosa no menor número de perguntas possíveis e com a maior pontuação!',
    },
  },
  {
    id: 'tennis',
    title: 'Grand Slam Tennis Masters',
    subtitle: 'Concreto, Saibro & Grama com Efeitos e Medidor de Força!',
    year: '1989 / 1993',
    genre: 'Esportes',
    players: '1 Jogador vs CPU / 2 Jogadores',
    coverImage: '/assets/images/tennis_cover_1790633341540.jpg',
    description: 'Experimente a emoção dos quatro cantos do circuito mundial de tênis! Escolha entre 3 tipos de quadra com física e quique autênticos (Saibro de Roland Garros, Grama de Wimbledon ou Concreto do US Open). Domine o saque com lançamento e timing no medidor de potência, aplique efeitos de Topspin, Slice e bolas retas planas (Flat) para superar o adversário em ralis eletrizantes!',
    accentColor: '#10b981',
    accentBg: 'from-emerald-950/40 to-slate-900',
    instructions: {
      keyboard: [
        'Setas / WASD: Mover o tenista pela quadra',
        'Espaço ou J: Manter pressionado para carregar FORÇA e soltar para golpear',
        'K / Z: Slice / Cortada (bola baixa com backspin flutuante)',
        'L / X: Topspin pesado (bola veloz com queda rápida e quique alto)',
        'No Saque: Pressione Espaço para lançar a bola ao ar, aperte novamente no ápice verde para um Saque Perfeito / ACE!',
      ],
      mobile: 'Use o D-Pad virtual para correr e posicione-se. Segure o botão de golpe para carregar o medidor de força e escolha os botões de Topspin, Slice ou Saque.',
      goal: 'Vença os games oficiais de tênis (15, 30, 40, Game) dominando os efeitos de bola e a física única de cada piso!',
    },
  },
  {
    id: 'detona_ralph',
    title: 'Detona Ralph (Fix-It Felix Jr.)',
    subtitle: 'O lendário arcade de 1982 do Edifício Niceland!',
    year: '1982 / 2012',
    genre: 'Arcade',
    players: '1 Jogador',
    coverImage: '/assets/images/detona_ralph_cover.svg',
    description: 'Ralph está furioso no telhado do Edifício Niceland quebrando vidraças e jogando tijolos! Controle Felix Jr., salte entre os parapeitos, use o martelo mágico dourado para consertar os vidros partidos, desvie dos tijolos e patos voadores, e coma as deliciosas tortas dos moradores para ganhar supervelocidade!',
    accentColor: '#f97316',
    accentBg: 'from-orange-950/40 to-slate-900',
    instructions: {
      keyboard: [
        'Setas Esquerda / Direita (ou A/D): Correr entre as janelas',
        'Seta Cima (ou W): Pular para a janela do andar superior',
        'Seta Baixo (ou S): Descer para a janela do andar inferior',
        'Espaço ou Z: Golpear com o Martelo Mágico (Consertar vidros)',
      ],
      mobile: 'Use o D-Pad virtual para mover e pular entre parapeitos, e toque no botão "CONSERTAR!" para martelar vidraças.',
      goal: 'Conserte todas as janelas danificadas para subir de fase e fazer Ralph se render! Desvie dos tijolos que caem e colete tortas!',
    },
  },
  {
    id: 'punch_out',
    title: 'Super Nocaute!! (Punch-Out)',
    subtitle: 'O lendário boxe arcade da Nintendo com Little Mac!',
    year: '1984 / 1994',
    genre: 'Luta',
    players: '1 Jogador',
    coverImage: '/assets/images/punch_out_cover.svg',
    description: 'Suba ao ringue no maior clássico de boxe arcade! Esquive dos socos telegrafados dos adversários, desfira jabs e ganchos devastadores, encha a barra de KO para disparar o Super Uppercut e mande os gigantes para a lona na contagem de 10!',
    accentColor: '#ef4444',
    accentBg: 'from-red-950/40 to-slate-900',
    instructions: {
      keyboard: [
        'Z / Seta Esquerda: Jab de Esquerda (Rosto)',
        'X / Seta Direita: Direto de Direita (Rosto)',
        'Seta Baixo + Z/X: Golpes na Linha de Cintura (Corpo)',
        'A / D: Esquivar para Esquerda / Direita',
        'S: Agachar / Esquivar por baixo',
        'W: Bloquear / Guarda Alta',
        'Barra de Espaço: SUPER NOCAUTE (com barra KO cheia!)',
      ],
      mobile: 'Use os botões de ação na tela: Esquivar, Bloquear, Jabs, Golpes no Corpo e botão KO!',
      goal: 'Derrube cada oponente 3 vezes para vencer por TKO ou nocauteie até o árbitro contar 10!',
    },
  },
  {
    id: 'sinuca',
    title: 'Sinuca de Bar (8-Ball)',
    subtitle: 'Física precisa de bilhar, mira laser e tacadas de efeito',
    year: '1984 / 1993',
    genre: 'Mesa',
    players: '1 ou 2 Jogadores',
    coverImage: '/assets/images/billiards_cover_1790633372016.jpg',
    description: 'A clássica sinuca de mesa verde com feltro de alta precisão! Jogue 1x1 com um amigo no modo 2 Jogadores (Pass & Play), enfrente o Computador (IA) ou treine no Modo Solo com regras oficiais da Bola 8 (Lisas vs Listradas).',
    accentColor: '#10b981',
    accentBg: 'from-emerald-950/40 to-slate-900',
    instructions: {
      keyboard: [
        'Mova o mouse ou use Setas Esquerda/Direita para mirar',
        'Puxe o taco para trás com o mouse/toque ou use a barra de força',
        'Solte para desferir a tacada',
        'Teclas A / D para ajuste fino de ângulo (precisão)',
      ],
      mobile: 'Arraste na mesa para mirar e puxe a barra lateral do taco para dosar a força da tacada',
      goal: 'Encaçape todas as bolas da mesa e termine encaçapando a bola 8 preta!',
    },
  },
  {
    id: 'pinball',
    title: 'Pinball Galáctico',
    subtitle: 'A adrenalina eletromecânica dos fliperamas',
    year: '1979 / 1992',
    genre: 'Arcade',
    players: '1 Jogador',
    coverImage: '/assets/images/pinball_cover_1790633361228.jpg',
    description: 'Puxe a mola do lançador, acione as palhetas com precisão milimétrica, acerte os bumpers de alta pontuação, ative multiplicadores e desbloqueie o frenético modo Multiball!',
    accentColor: '#8b5cf6',
    accentBg: 'from-violet-950/40 to-slate-900',
    instructions: {
      keyboard: [
        'Z ou Seta Esquerda ou A para Palheta Esquerda',
        '/ ou Seta Direita ou D para Palheta Direita',
        'Barra de Espaço ou Seta Baixo para puxar a mola do lançador',
        'Mantenha pressionado para acumular força de lançamento',
      ],
      mobile: 'Botões tácteis dedicados nas laterais e gatilho de mola',
      goal: 'Mantenha a esfera em jogo, acerte os bumpers e ative multiplicadores de bônus!',
    },
  },
  {
    id: 'soletrando',
    title: 'Show do Soletrando',
    subtitle: 'Palavra Misteriosa com Tema e Letras Reveladas (Silvio Santos)',
    year: '1999 / 2003',
    genre: 'Puzzle',
    players: '1 Jogador',
    coverImage: '/assets/images/soletrando_cover.svg',
    description: 'Descubra a palavra misteriosa sem saber o nome de antemão! Veja o tema da palavra embaixo, aproveite as letras pré-reveladas como pistas e preencha as lacunas que faltam para faturar até 1 Milhão em barras de ouro!',
    accentColor: '#eab308',
    accentBg: 'from-amber-950/40 to-slate-900',
    instructions: {
      keyboard: [
        'Consulte o TEMA da palavra exibido logo abaixo das letras',
        'As letras em dourado já são reveladas de início como pistas',
        'Digite as letras restantes pelo teclado ou clique nas teclas virtuais',
        'Use "Me dá uma letra!" para Silvio revelar mais uma letra oculta',
        'Enter ou botão "Confirmar" para validar sua resposta',
      ],
      mobile: 'Teclado virtual na tela e botões de ajuda do Silvio',
      goal: 'Decifre a palavra misteriosa pelo tema e letras-guia para faturar 1 Milhão em barras de ouro!',
    },
  },
  {
    id: 'donkey_kong',
    title: 'Gorila Barris (Kong)',
    subtitle: 'O lendário desafio de vigas, escadas e barris',
    year: '1981',
    genre: 'Arcade',
    players: '1 Jogador',
    coverImage: '/assets/images/arcade_kong_cover_1790633382770.jpg',
    description: 'Corra pelas vigas de aço, suba escadas, salte sobre os barris arremessados pelo gorila gigante e use o martelo para salvar a donzela no topo!',
    accentColor: '#f97316',
    accentBg: 'from-orange-950/40 to-slate-900',
    instructions: {
      keyboard: [
        'Setas Esquerda / Direita ou A / D para correr',
        'Seta Cima / Baixo ou W / S para subir e descer escadas',
        'Barra de Espaço para pular sobre barris (+100 pts)',
        'Pegue o Martelo de Ouro para esmagar barris (+300 pts)',
      ],
      mobile: 'Use o direcional D-pad para correr/escalar e o botão PULAR',
      goal: 'Suba até o topo sem ser atingido pelos barris e resgate a princesa!',
    },
  },
  {
    id: 'snake',
    title: 'Cobrinha Clássica',
    subtitle: 'Nostalgia pura dos celulares e arcades',
    year: '1976 / 1997',
    genre: 'Arcade',
    players: '1 Jogador',
    coverImage: '/assets/images/snake_cover.svg',
    description: 'Controle a cobra faminta, devore as maçãs para crescer e evite colidir contra as bordas e seu próprio corpo.',
    accentColor: '#22c55e',
    accentBg: 'from-emerald-950/40 to-slate-900',
    instructions: {
      keyboard: ['Setas direcionais ou W/A/S/D para mover', 'Espaço para pausar/retomar'],
      mobile: 'Use o direcional virtual ou deslize o dedo na tela',
      goal: 'Coma o máximo de frutas e bata seu recorde sem bater!',
    },
  },
  {
    id: 'tetris',
    title: 'Blocos Retrô',
    subtitle: 'O puzzle geométrico mais famoso do mundo',
    year: '1984',
    genre: 'Puzzle',
    players: '1 Jogador',
    coverImage: '/assets/images/tetris_cover.svg',
    description: 'Encaixe os 7 formatos de tetrominoes perfeitamente para eliminar linhas inteiras e alcançar combos estratosféricos.',
    accentColor: '#06b6d4',
    accentBg: 'from-cyan-950/40 to-slate-900',
    instructions: {
      keyboard: [
        'Setas Esquerda/Direita para mover',
        'Seta Cima ou X para rotacionar',
        'Seta Baixo para descida suave',
        'Espaço para queda rápida instantânea (Hard Drop)',
        'C ou Shift para segurar peça (Hold)',
      ],
      mobile: 'Use os botões de toque na tela para girar, mover e soltar',
      goal: 'Complete fileiras horizontais para pontuar e subir de nível!',
    },
  },
  {
    id: 'invaders',
    title: 'Invasores Espaciais',
    subtitle: 'Defenda a Terra da armada alienígena',
    year: '1978',
    genre: 'Ação',
    players: '1 Jogador',
    coverImage: '/assets/images/invaders_cover.svg',
    description: 'Pilote sua nave canhão, destrua as fileiras de invasores alienígenas descendentes e proteja-se atrás dos bunkers de defesa.',
    accentColor: '#ec4899',
    accentBg: 'from-pink-950/40 to-slate-900',
    instructions: {
      keyboard: [
        'Setas Esquerda/Direita ou A/D para pilotar',
        'Barra de Espaço para disparar lasers',
        'P para pausar',
      ],
      mobile: 'Direcional esquerdo/direito e botão de disparo turbo',
      goal: 'Elimine toda a esquadra antes que atinjam a superfície terrestre!',
    },
  },
  {
    id: 'breakout',
    title: 'Quebra-Blocos',
    subtitle: 'O viciante desafio de rebater bolas',
    year: '1976',
    genre: 'Arcade',
    players: '1 Jogador',
    coverImage: '/assets/images/breakout_cover.svg',
    description: 'Mova a raquete para rebater a esfera em alta velocidade, estilhaçando barreiras de blocos coloridos e capturando power-ups.',
    accentColor: '#f59e0b',
    accentBg: 'from-amber-950/40 to-slate-900',
    instructions: {
      keyboard: [
        'Setas Esquerda/Direita ou Mouse para mover a raquete',
        'Espaço para lançar a bola inicial',
      ],
      mobile: 'Arraste o dedo ou use os botões direcionais',
      goal: 'Destrua todos os tijolos da fase sem deixar a bola cair!',
    },
  },
  {
    id: 'minesweeper',
    title: 'Campo Minado',
    subtitle: 'Estratégia, dedução lógica e precisão',
    year: '1989',
    genre: 'Puzzle',
    players: '1 Jogador',
    coverImage: '/assets/images/minesweeper_cover.svg',
    description: 'Revele todos os quadrantes vazios sem detonar nenhuma das minas ocultas usando as pistas numéricas de adjacência.',
    accentColor: '#3b82f6',
    accentBg: 'from-blue-950/40 to-slate-900',
    instructions: {
      keyboard: [
        'Clique esquerdo: Abrir célula',
        'Clique direito: Marcar com bandeira',
      ],
      mobile: 'Alterne o modo "Revelar" ou "Bandeira" no interruptor',
      goal: 'Limpe todo o tabuleiro marcando com segurança onde estão os explosivos!',
    },
  },
  {
    id: 'pong',
    title: 'Tênis Retrô (Pong)',
    subtitle: 'O clássico pioneiro que iniciou os games',
    year: '1972',
    genre: 'Mesa',
    players: '1P vs IA ou 2P Local',
    coverImage: '/assets/images/pong_cover.svg',
    description: 'Duelo épico de raquetes digitais! Jogue contra uma IA esperta com diferentes dificuldades ou desafie um amigo no mesmo teclado.',
    accentColor: '#a855f7',
    accentBg: 'from-purple-950/40 to-slate-900',
    instructions: {
      keyboard: [
        'Jogador 1 (Esquerda): W / S para mover',
        'Jogador 2 (Direita / 2P): Setas Cima / Baixo',
        'No modo 1P, você controla a raquete esquerda com W/S ou Setas',
      ],
      mobile: 'Arraste a raquete com o dedo ou use os controles laterais',
      goal: 'Seja o primeiro a marcar 7 pontos no placar!',
    },
  },
];

export function getHighScore(gameId: GameId): number {
  if (typeof window === 'undefined') return 0;
  const val = localStorage.getItem(`arcade_hs_${gameId}`);
  return val ? parseInt(val, 10) || 0 : 0;
}

export function saveHighScore(gameId: GameId, score: number): boolean {
  if (typeof window === 'undefined') return false;
  const current = getHighScore(gameId);
  if (score > current) {
    localStorage.setItem(`arcade_hs_${gameId}`, String(score));
    return true; // New record!
  }
  return false;
}
