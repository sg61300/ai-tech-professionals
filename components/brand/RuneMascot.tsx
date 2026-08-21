'use client';

/**
 * RuneMascot — production React component for the Rune AI mascot.
 * ---------------------------------------------------------------------------
 * Drives the RuneStateMachine (7 states) on a FLAT sprite (`spriteSrc`) using
 * body-first CSS transforms + a requestAnimationFrame loop. State is controlled
 * by the host app via the `state` prop — the app's own logic decides when Rune
 * greets, thinks, celebrates, etc.
 *
 * Why CSS/RAF and not Rive?
 *   The canonical art is a single flat render, not the 23 inpainted rig layers a
 *   `.riv` needs. This component is the faithful BEHAVIORAL + TIMING layer and the
 *   drop-in API. When an animator delivers `rune-mascot.riv`, swap the render at
 *   the marked seam below — the prop contract is identical, so no app changes.
 *
 * Honors the playbook's Unbreakable Rule: the BODY is the focal motion of every
 * state (breathing, silhouette wing-open, tail sway, hop, lean, weight-shift).
 * The cyan rune glow is strictly SECONDARY. It never animates alone.
 *
 * Design tokens: rune glow cyan #8B5CF6 · streak flame amber #F59E0B.
 *
 * Usage:
 *   const [mood, setMood] = useState<RuneState>('idle');
 *   <RuneMascot
 *     state={mood}
 *     spriteSrc="/assets/mascot/rune-canonical.png"
 *     processingSpeed={1.0}
 *     onStateComplete={() => setMood('idle')}
 *   />
 *
 * Notes / known flat-sprite limits (need the rig):
 *   - Independent per-limb motion (real wing flap, arm wave, mesh-warp foreshorten)
 *     and eye blinks require the separated layers; they are approximated here with
 *     whole-body silhouette transforms and omitted where a fake would look wrong.
 *
 * ⚠️ USE A TRANSPARENT CUT-OUT FOR BEST FIDELITY:
 *   Supply `spriteSrc` as the dragon CUT OUT on a transparent canvas (playbook §2
 *   steps 1 & 3 — `rune-canonical.png`, background delivered separately). If the
 *   sprite has the twilight sky BAKED IN, the body transforms move the sky with it
 *   (the whole frame appears to tilt/scale/lift). With a transparent cut-out, ONLY
 *   the body animates against your app's own background — no code changes needed.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ Types */

export type RuneState =
  | 'idle'
  | 'greet'
  | 'thinking'
  | 'celebrate'
  | 'streak'
  | 'streakAtRisk'
  | 'grill';

export interface RuneMascotProps {
  /** Current mascot state, driven by app logic. */
  state: RuneState;
  /** Path/URL to the flat dragon sprite (its baked twilight-sky bg is kept). */
  spriteSrc: string;
  /** Rendered square size in px. Default 256. */
  dimensions?: number;
  /** Playback multiplier the Thinking loop reads (playbook `speed` Number input). Default 1.0. */
  processingSpeed?: number;
  /** Fires when a one-shot (greet/celebrate/streak/grill) resolves back to Idle. */
  onStateComplete?: () => void;
  /** Orb position as % of the sprite box, for the secondary glow. Default {x:33,y:47}. */
  runeGlowOrigin?: { x: number; y: number };
  /** Optional still shown under reduced-motion. Defaults to `spriteSrc`. */
  staticFallbackSrc?: string;
  /** Optional extra className on the root. */
  className?: string;
}

/* --------------------------------------------------------------- Tokens */

const RUNE_CYAN = '#8B5CF6';
const RUNE_AMBER = '#F59E0B';

const TRIGGERS: readonly RuneState[] = ['greet', 'celebrate', 'streak', 'grill'];
const isTrigger = (s: RuneState) => TRIGGERS.includes(s);

/** Master timings from the 60fps playbook (§4). Durations in ms. */
const DURATION: Record<RuneState, number> = {
  idle: 4000, // 240f
  greet: 1200, // 72f
  thinking: 2000, // 120f
  celebrate: 1500, // 90f
  streak: 1500, // 90f
  streakAtRisk: 2000, // 120f
  grill: 1200, // 72f
};

const LOOPING: Record<RuneState, boolean> = {
  idle: true,
  thinking: true,
  streakAtRisk: true,
  greet: false,
  celebrate: false,
  streak: false,
  grill: false,
};

/** Blend timings from the state machine (§5): 150ms in, 200ms exit to Idle. */
const BLEND_IN = 150;
const BLEND_OUT = 200;

/* ---------------------------------------------------- Transform params */

interface Params {
  ty: number; // translateY px
  sx: number; // scaleX
  sy: number; // scaleY
  rot: number; // rotate deg
  skx: number; // skewX deg (tail sway / weight shift)
  rotX: number; // rotateX deg (2.5D foreshorten, grill)
  glowO: number; // rune glow opacity  (SECONDARY)
  glowS: number; // rune glow scale
}

const BASE: Params = { ty: 0, sx: 1, sy: 1, rot: 0, skx: 0, rotX: 0, glowO: 0.75, glowS: 1 };

/* ------------------------------------------------------------- Easing */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const easeInOutCubic = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
/** Bell: 0→1→0 over p∈[0,1], seamless at the ends. */
const bell = (p: number) => Math.sin(clamp01(p) * Math.PI);
/** Piecewise ramp between phase boundaries with easing. */
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

const lerpParams = (from: Params, to: Params, k: number): Params => ({
  ty: lerp(from.ty, to.ty, k),
  sx: lerp(from.sx, to.sx, k),
  sy: lerp(from.sy, to.sy, k),
  rot: lerp(from.rot, to.rot, k),
  skx: lerp(from.skx, to.skx, k),
  rotX: lerp(from.rotX, to.rotX, k),
  glowO: lerp(from.glowO, to.glowO, k),
  glowS: lerp(from.glowS, to.glowS, k),
});

/* ------------------------------------------------------ State timelines
 * Each returns the body+glow params for progress p∈[0,1] at wall-clock `t`.
 * transform-origin is the feet (ground-lock, no sliding).
 */

// IDLE — breathing homeostasis, tail sway, wing micro-unfold, glow sine 60↔90%.
function tlIdle(p: number): Params {
  const breath = bell(p); // inhale to peak at mid, exhale back — seamless loop
  const sway = Math.sin(p * Math.PI * 2);
  return {
    ty: -3 * breath,
    sx: 1 + 0.008 * breath + 0.006 * Math.max(0, sway), // subtle wing unfold on the swell
    sy: 1 + 0.03 * breath, // chest +3%
    rot: 0.4 * sway,
    skx: 1.5 * sway, // slow tail crescent
    rotX: 0,
    glowO: 0.75 + 0.15 * sway, // 0.60 ↔ 0.90
    glowS: 1 + 0.04 * sway,
  };
}

// GREET — anticipation nod, warm rock, wings open +15%, bright glow.
function tlGreet(p: number): Params {
  const lift = easeOutCubic(seg(p, 0, 0.25)); // arm-lift beat (whole-body rise proxy)
  const settle = easeInOutCubic(seg(p, 0.62, 1));
  const open = bell(seg(p, 0.1, 0.85)); // wings open then settle
  const wave = Math.sin(seg(p, 0.25, 0.63) * Math.PI * 3) * (1 - settle); // 3 wrist waves
  return {
    ty: -7 * open,
    sx: 1 + 0.15 * open, // wings open +15%
    sy: 1 + 0.02 * open,
    rot: -4 * lift * (1 - settle) + 2.5 * wave, // −4° nod → warm rock
    skx: 1.2 * wave,
    rotX: 0,
    glowO: 0.9,
    glowS: 1.05,
  };
}

// THINKING — head-tilt hold + micro-oscillation, half-speed breathing, glow 50↔100%.
function tlThinking(p: number, t: number): Params {
  const settleIn = easeInOutCubic(clamp01(p / 0.25));
  const micro = 0.6 * Math.sin(t / 380); // gentle live wobble on the held tilt
  const glowOsc = Math.sin(p * Math.PI * 2);
  return {
    ty: -1.5,
    sx: 1,
    sy: 1 + 0.02 * bell(p), // breathing at half depth
    rot: -8 * settleIn + micro, // 8° tilt toward the rune
    skx: -1.5 * settleIn,
    rotX: 0,
    glowO: 0.75 + 0.25 * glowOsc, // 0.50 ↔ 1.00
    glowS: 1 + 0.05 * glowOsc,
  };
}

// CELEBRATE — compress → launch (hop + stretch) → apex (wings full) → cushioned landing.
function tlCelebrate(p: number): Params {
  // Phases: 0–.17 compress · .17–.39 launch · .39–.61 apex · .61–.76 land · .76–1 settle
  const compress = bell(seg(p, 0, 0.17));
  const launch = easeOutCubic(seg(p, 0.17, 0.39));
  const fall = easeInOutCubic(seg(p, 0.55, 0.75));
  const landSquash = bell(seg(p, 0.72, 0.82));
  const settle = easeInOutCubic(seg(p, 0.82, 1));
  const airborne = clamp01(launch - fall); // 0→1 up, back to 0 on contact
  const wings = bell(seg(p, 0.3, 0.75));
  return {
    ty: -44 * airborne + 4 * compress, // dip on compress, rise on hop
    sx: 1 + 0.2 * wings, // full wing extension at apex
    sy: 1 - 0.12 * compress + 0.08 * launch - 0.06 * landSquash - 0 * settle, // squash/stretch
    rot: 0,
    skx: 6 * wings * Math.sin(p * Math.PI * 2), // tail whip
    rotX: 0,
    glowO: 0.7 + 0.25 * airborne,
    glowS: 1 + 0.12 * airborne,
  };
}

// STREAK / FIRE — anticipation compress → proud rise → amber flame burst (F22) → furl.
function tlStreak(p: number): Params {
  const antic = bell(seg(p, 0, 0.17));
  const rise = easeOutCubic(seg(p, 0.17, 0.33));
  const furl = easeInOutCubic(seg(p, 0.61, 1));
  const proud = clamp01(rise - furl);
  const wings = bell(seg(p, 0.2, 0.9));
  return {
    ty: -6 * proud - 3 * antic,
    sx: 1 + 0.2 * wings, // wings to max
    sy: 1 - 0.08 * antic + 0.05 * proud, // 105% proud height
    rot: -3 * antic + 10 * proud * 0.1, // small anticipation lean, then head snap
    skx: 4 * wings * Math.sin(p * Math.PI * 2),
    rotX: 0,
    glowO: 0.85 + 0.15 * proud,
    glowS: 1.05 + 0.1 * proud,
  };
}

// STREAK-AT-RISK — slump, weight shift, dimmed glow, pleading rhythmic rock.
function tlStreakAtRisk(p: number): Params {
  const slump = easeInOutCubic(clamp01(p / 0.33));
  const shift = Math.sin(p * Math.PI * 2); // weight shift hip-to-hip
  const plead = Math.sin(seg(p, 0.33, 0.66) * Math.PI); // "come on, you can do it"
  return {
    ty: 5 * slump, // sinks ~5%
    sx: 1,
    sy: 1 - 0.05 * slump, // slumped vertical
    rot: 1.5 * shift + 1.2 * plead,
    skx: 2.2 * shift,
    rotX: 0,
    glowO: 0.4 + 0.1 * ((shift + 1) / 2), // dimmed
    glowS: 0.95,
  };
}

// GRILL-ME — coil back+up → forward surge to 115% w/ 2.5D foreshorten → float hold → resolve.
function tlGrill(p: number): Params {
  const coil = bell(seg(p, 0, 0.17));
  const surge = easeOutCubic(seg(p, 0.17, 0.42));
  const resolve = easeInOutCubic(seg(p, 0.76, 1));
  const forward = clamp01(surge - resolve);
  const floatHold = Math.sin(seg(p, 0.42, 0.76) * Math.PI * 3) * (1 - resolve); // living hover
  const flap = bell(seg(p, 0.82, 1)); // one balancing flap on resolve
  return {
    ty: -4 * coil - 2 * forward + 2 * floatHold,
    sx: 1 + 0.15 * forward + 0.06 * flap, // 115% forward + settle flap
    sy: 1 + 0.05 * coil + 0.15 * forward,
    rot: -5 * coil,
    skx: 0,
    rotX: 6 * forward, // lean toward the viewer (perspective applied on the box)
    glowO: 0.8 + 0.2 * forward,
    glowS: 1 + 0.08 * forward,
  };
}

const TIMELINES: Record<RuneState, (p: number, t: number) => Params> = {
  idle: (p) => tlIdle(p),
  greet: (p) => tlGreet(p),
  thinking: (p, t) => tlThinking(p, t),
  celebrate: (p) => tlCelebrate(p),
  streak: (p) => tlStreak(p),
  streakAtRisk: (p) => tlStreakAtRisk(p),
  grill: (p) => tlGrill(p),
};

/* ------------------------------------------------------- Flame particles */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --------------------------------------------------------- Component */

export const RuneMascot: React.FC<RuneMascotProps> = ({
  state,
  spriteSrc,
  dimensions = 256,
  processingSpeed = 1.0,
  onStateComplete,
  runeGlowOrigin = { x: 33, y: 47 },
  staticFallbackSrc,
  className,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLImageElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);

  // Live runtime, kept in refs so the RAF loop never closes over stale values.
  const rt = useRef({
    tl: 'idle' as RuneState, // timeline currently playing
    start: 0,
    blendFrom: BASE,
    blendStart: 0,
    blendDur: BLEND_IN,
    completed: false,
    flameFired: false,
  });
  const displayed = useRef<Params>(BASE);
  const speedRef = useRef(processingSpeed);
  const onDoneRef = useRef(onStateComplete);
  const particles = useRef<Particle[]>([]);
  const rafId = useRef<number | null>(null);
  const visible = useRef(true);

  useEffect(() => {
    speedRef.current = processingSpeed;
  }, [processingSpeed]);
  useEffect(() => {
    onDoneRef.current = onStateComplete;
  }, [onStateComplete]);

  /* Reduced-motion: track live. */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  /* Begin a new timeline with a blend (fires only on a real state change). */
  const startTimeline = useCallback((next: RuneState, blendMs: number) => {
    const now = performance.now();
    rt.current = {
      tl: next,
      start: now,
      blendFrom: displayed.current,
      blendStart: now,
      blendDur: blendMs,
      completed: false,
      flameFired: false,
    };
  }, []);

  const spawnFlame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ox = (runeGlowOrigin.x / 100) * dimensions;
    const oy = (runeGlowOrigin.y / 100) * dimensions + dimensions * 0.06; // rune base
    const n = 30;
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.9; // upward arc sweep
      const spd = 0.9 + Math.random() * 1.7;
      const life = 520 + Math.random() * 420;
      particles.current.push({
        x: ox + (Math.random() - 0.5) * 10,
        y: oy + (Math.random() - 0.5) * 8,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life,
        maxLife: life,
        size: 6 + Math.random() * 12,
      });
    }
  }, [dimensions, runeGlowOrigin.x, runeGlowOrigin.y]);

  /* React to app-driven state changes. */
  const prevState = useRef<RuneState>('idle');
  useEffect(() => {
    if (state === prevState.current) return;
    prevState.current = state;
    startTimeline(state, BLEND_IN); // 150ms blend in; streak's flame fires inside the loop at F22
  }, [state, startTimeline]);

  /* The animation loop. */
  useEffect(() => {
    if (reducedMotion) {
      // Static compliant pose — component still renders; app stays usable.
      applyParams(spriteRef.current, glowRef.current, { ...BASE, glowO: 0.8 });
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas ? canvas.getContext('2d') : null;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    if (canvas && ctx) {
      canvas.width = dimensions * dpr;
      canvas.height = dimensions * dpr;
      ctx.scale(dpr, dpr);
    }

    let last = performance.now();
    // Anchor timelines to "now" on (re)start so a resume doesn't jump.
    rt.current.start = last;
    rt.current.blendStart = last;

    const frame = (now: number) => {
      const dt = now - last;
      last = now;
      const r = rt.current;

      // Offscreen pause: freeze the clock so nothing advances, skip render/draw.
      if (!visible.current) {
        r.start += dt;
        r.blendStart += dt;
        rafId.current = requestAnimationFrame(frame);
        return;
      }

      const speed = r.tl === 'thinking' ? Math.max(0.1, speedRef.current) : 1;
      const dur = DURATION[r.tl] / speed;
      const elapsed = now - r.start;
      const p = LOOPING[r.tl] ? (elapsed % dur) / dur : clamp01(elapsed / dur);

      const raw = TIMELINES[r.tl](p, now);
      const bk = now - r.blendStart;
      const disp =
        bk < r.blendDur ? lerpParams(r.blendFrom, raw, bk / r.blendDur) : raw;
      displayed.current = disp;
      applyParams(spriteRef.current, glowRef.current, disp);

      // Amber flame burst at F22 (~p 0.24) of the streak timeline.
      if (r.tl === 'streak' && !r.flameFired && p >= 0.24) {
        spawnFlame();
        r.flameFired = true;
      }
      drawFlames(ctx, particles.current, dt);

      // One-shot resolved → blend back to Idle, notify the app once.
      if (!LOOPING[r.tl] && !r.completed && elapsed >= dur) {
        r.completed = true;
        onDoneRef.current?.();
        startTimeline('idle', BLEND_OUT); // Exit Time 100% → 200ms to Idle
      }

      rafId.current = requestAnimationFrame(frame);
    };
    rafId.current = requestAnimationFrame(frame);

    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      rafId.current = null;
    };
  }, [reducedMotion, dimensions, spawnFlame, startTimeline]);

  /* Offscreen pause (IntersectionObserver) — the RAF loop reads `visible` and
     freezes its clock while offscreen, so motion resumes seamlessly on return. */
  useEffect(() => {
    if (reducedMotion || typeof IntersectionObserver === 'undefined') return;
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting;
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reducedMotion]);

  const px = `${dimensions}px`;

  return (
    <div
      ref={rootRef}
      className={className}
      role="img"
      aria-label="Rune, the AI mascot"
      style={{
        position: 'relative',
        width: px,
        height: px,
        perspective: '700px', // enables the grill 2.5D lean (rotateX)
        overflow: 'visible',
        userSelect: 'none',
      }}
    >
      {/* Ground shadow — anchors weight, reads the hop/slump. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '4%',
          width: '46%',
          height: '7%',
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(2,6,23,0.45), rgba(2,6,23,0))',
          pointerEvents: 'none',
        }}
      />

      {/* SECONDARY: rune glow at the orb. Never the focal motion. */}
      <div
        ref={glowRef}
        aria-hidden
        style={{
          position: 'absolute',
          left: `${runeGlowOrigin.x}%`,
          top: `${runeGlowOrigin.y}%`,
          width: '42%',
          height: '42%',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${RUNE_CYAN}cc 0%, ${RUNE_CYAN}55 35%, ${RUNE_CYAN}00 70%)`,
          mixBlendMode: 'screen',
          filter: 'blur(2px)',
          pointerEvents: 'none',
          willChange: 'opacity, transform',
        }}
      />

      {/* The body. transform-origin at the feet = ground-lock. */}
      <img
        ref={spriteRef}
        src={reducedMotion && staticFallbackSrc ? staticFallbackSrc : spriteSrc}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          transformOrigin: '50% 100%',
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
      />

      {/* Amber flame FX layer (streak). */}
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          mixBlendMode: 'screen',
        }}
      />

      {/*
        ───────────────────────── RIVE SWAP SEAM ─────────────────────────
        When `rune-mascot.riv` exists, replace <img>+<canvas>+glow above with
        the Rive canvas and keep this exact prop contract:

          const { rive, RiveComponent } = useRive({
            src: '/assets/mascot/rune-mascot.riv',
            stateMachines: 'RuneStateMachine',
            autoplay: true,
          });
          // map props → inputs: greet/celebrate/streak/grill .fire();
          //   thinking/streakAtRisk = boolean; speed = processingSpeed;
          //   onStateComplete via EventType.StateChange back to 'Idle'.

        No host-app changes needed: <RuneMascot state=… /> stays identical.
      */}
    </div>
  );
};

/* --------------------------------------------------------- Renderers */

function applyParams(
  img: HTMLImageElement | null,
  glow: HTMLDivElement | null,
  p: Params,
): void {
  if (img) {
    img.style.transform =
      `translateY(${p.ty.toFixed(2)}px) ` +
      `rotateX(${p.rotX.toFixed(2)}deg) ` +
      `rotate(${p.rot.toFixed(2)}deg) ` +
      `skewX(${p.skx.toFixed(2)}deg) ` +
      `scale(${p.sx.toFixed(4)}, ${p.sy.toFixed(4)})`;
  }
  if (glow) {
    glow.style.opacity = p.glowO.toFixed(3);
    glow.style.transform = `translate(-50%, -50%) scale(${p.glowS.toFixed(3)})`;
  }
}

function drawFlames(
  ctx: CanvasRenderingContext2D | null,
  list: Particle[],
  dt: number,
): void {
  if (!ctx) return;
  const w = ctx.canvas.width / (window.devicePixelRatio || 1);
  const h = ctx.canvas.height / (window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, w, h);
  if (list.length === 0) return;

  for (let i = list.length - 1; i >= 0; i--) {
    const pt = list[i];
    pt.life -= dt;
    if (pt.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    // integrate (dt normalised to ~60fps steps), buoyant rise + slight drag
    const step = dt / 16.67;
    pt.x += pt.vx * step;
    pt.y += pt.vy * step;
    pt.vy -= 0.05 * step; // buoyancy
    pt.vx *= 0.99;

    const k = pt.life / pt.maxLife; // 1 → 0
    const alpha = Math.min(1, k * 1.4);
    const radius = pt.size * (1 + (1 - k) * 1.6); // expands as it burns
    const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
    // amber core → transparent (clean burn dissipation)
    g.addColorStop(0, `rgba(255, 236, 179, ${alpha})`);
    g.addColorStop(0.4, `rgba(245, 158, 11, ${alpha * 0.85})`); // #F59E0B
    g.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default RuneMascot;
