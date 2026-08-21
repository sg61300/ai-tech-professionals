'use client';

/**
 * RuneLoader — "Rune is Tuning" (Design/_design-tokens.md §Loader).
 * Shown wherever there is AI/API latency (OTP verify, Google auth, every AI
 * generation in sims, reel load). Violet = the AI signal.
 *
 * - Rune in `thinking` state + a rotating violet orb (CSS) with an expanding
 *   pulse ring. Copy rotates through the witty voice.
 * - Reduced-motion: orb stops spinning (static glow); copy still cross-fades slowly.
 * - Real-app guidance: mount after ~250ms latency (avoid flash on fast responses);
 *   on error the caller swaps to the scripted-fallback UI (every AI feature has one).
 */

import { useEffect, useState } from 'react';
import { RuneMascot } from './RuneMascot';

const LINES = [
  'Rune is tuning your thinking…',
  'Consulting the rune…',
  'Warming up the AI…',
  'Reading between your lines…',
  'Summoning a smart answer…',
];

export interface RuneLoaderProps {
  /** Sprite for Rune. Defaults to the canonical art. */
  spriteSrc?: string;
  /** Mascot size in px. Default 160. */
  size?: number;
  /** ms between copy rotations. Default 1900. */
  interval?: number;
  className?: string;
}

export function RuneLoader({
  spriteSrc = '/mascot/rune-hero-clean.png',
  size = 160,
  interval = 1900,
  className,
}: RuneLoaderProps) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % LINES.length), interval);
    return () => clearInterval(id);
  }, [interval]);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 ${className ?? ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative" style={{ width: size, height: size }}>
        {/* expanding violet pulse ring — the AI signal */}
        <span className="rl-ring" aria-hidden />
        <span className="rl-orb" aria-hidden />
        <RuneMascot state="thinking" spriteSrc={spriteSrc} dimensions={size} />
      </div>

      <p key={i} className="rl-copy text-sm font-medium text-muted-foreground">
        {LINES[i]}
      </p>

      <style>{`
        .rl-ring {
          position: absolute; inset: 0; margin: auto;
          width: 70%; height: 70%; border-radius: 9999px;
          border: 2px solid var(--violet);
          opacity: 0.5; transform: scale(0.7);
          animation: rl-pulse 1800ms ease-out infinite;
        }
        .rl-orb {
          position: absolute; left: 22%; top: 40%;
          width: 14px; height: 14px; border-radius: 9999px;
          background: var(--violet);
          box-shadow: 0 0 18px 6px color-mix(in srgb, var(--violet) 55%, transparent);
          animation: rl-spin 2400ms linear infinite;
          transform-origin: 60px 40px;
        }
        .rl-copy { animation: rl-fade 1900ms ease-in-out; }
        @keyframes rl-pulse {
          0%   { transform: scale(0.7); opacity: 0.55; }
          100% { transform: scale(1.15); opacity: 0; }
        }
        @keyframes rl-spin { to { transform: rotate(360deg); } }
        @keyframes rl-fade { 0% { opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0.85; } }
        @media (prefers-reduced-motion: reduce) {
          .rl-ring { animation: none; opacity: 0.4; transform: scale(1); }
          .rl-orb  { animation: none; }
          .rl-copy { animation: rl-fade 1900ms ease-in-out; }
        }
      `}</style>
    </div>
  );
}

export default RuneLoader;
