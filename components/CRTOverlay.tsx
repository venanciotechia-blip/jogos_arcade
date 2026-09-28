'use client';

import React from 'react';

interface CRTOverlayProps {
  enabled: boolean;
}

export function CRTOverlay({ enabled }: CRTOverlayProps) {
  if (!enabled) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-xl">
      {/* Scanlines */}
      <div 
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%)',
          backgroundSize: '100% 4px',
        }}
      />
      {/* Vignette curvature */}
      <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.7)]" />
      {/* Subtle CRT chromatic phosphor glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-amber-500/5 mix-blend-overlay" />
    </div>
  );
}
