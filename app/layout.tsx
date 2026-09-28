import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Arcade Clássicos - Jogos Retrô',
  description: 'Coleção nostálgica de jogos clássicos de arcade: Snake, Tetris, Space Invaders, Pong, Breakout e Campo Minado para jogar no navegador.',
  openGraph: {
    title: 'Arcade Clássicos - Jogos Retrô',
    description: 'Coleção nostálgica de jogos clássicos de arcade: Snake, Tetris, Space Invaders, Pong, Breakout e Campo Minado para jogar no navegador.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Arcade Clássicos - Jogos Retrô',
    description: 'Coleção nostálgica de jogos clássicos de arcade: Snake, Tetris, Space Invaders, Pong, Breakout e Campo Minado para jogar no navegador.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning className="bg-[#271042] text-[#00f5ff] antialiased min-h-screen selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
