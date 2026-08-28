"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { reelThumbUrl, reelWatchUrl } from "@/lib/reels/thumb";
import "./reels-carousel.css";

export type ReelItem = { id: number; title: string; url: string };

/** Deterministic gradient for a fallback tile (reel with no YouTube id / broken thumb). */
const GRADIENTS = [
  ["#0d9488", "#14b8a6"],
  ["#8b5cf6", "#6366f1"],
  ["#fb7185", "#f43f5e"],
  ["#38bdf8", "#0ea5e9"],
  ["#f59e0b", "#f97316"],
  ["#22c55e", "#10b981"],
  ["#a855f7", "#ec4899"],
];
function grad(id: number): string {
  const g = GRADIENTS[Math.abs(id) % GRADIENTS.length];
  return `linear-gradient(155deg, ${g[0]}, ${g[1]})`;
}

// Coverflow constants (tuned + user-approved — see vault spec).
const SPACING = 62;
const PLATEAU = 60;
const ANGLE = 38;
const DEPTH = 190;

/**
 * Saved-reels launcher + full-screen infinite 3D coverflow (view-only).
 * Lives inside Profile ▸ Second brain. Renders nothing with zero reels.
 */
export function SavedReelsCarousel({ reels }: { reels: ReelItem[] }) {
  const N = reels.length;
  const [open, setOpen] = useState(false);
  const [centerIdx, setCenterIdx] = useState(0);
  const [reduce, setReduce] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const stageRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const launchRef = useRef<HTMLButtonElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const pos = useRef(0);
  const raf = useRef<number | null>(null);
  const lastIdx = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // shortest circular distance from card i to current pos (infinite wrap)
  const circ = useCallback(
    (i: number) => {
      let d = i - pos.current;
      d = ((d % N) + N) % N;
      if (d > N / 2) d -= N;
      return d;
    },
    [N],
  );

  const render = useCallback(() => {
    for (let i = 0; i < N; i++) {
      const card = cardRefs.current[i];
      if (!card) continue;
      const d = circ(i);
      const ad = Math.abs(d);
      if (ad > 3.2) {
        card.style.opacity = "0";
        card.style.pointerEvents = "none";
        continue;
      }
      const clamped = Math.max(-1, Math.min(1, d));
      const x = d * SPACING + clamped * PLATEAU;
      const rot = reduce ? 0 : -clamped * ANGLE;
      const scale = reduce ? (ad < 0.5 ? 1 : 0.8) : Math.max(0.72, 1 - ad * 0.16);
      const z = reduce ? 0 : -ad * DEPTH;
      card.style.transform = `translateX(${x}px) translateZ(${z}px) rotateY(${rot}deg) scale(${scale})`;
      card.style.opacity = String(Math.max(0, 1 - ad * 0.34));
      card.style.zIndex = String(100 - Math.round(ad * 10));
      card.style.pointerEvents = ad < 1.5 ? "auto" : "none";
      card.classList.toggle("center", ad < 0.5);
    }
    const idx = ((Math.round(pos.current) % N) + N) % N;
    if (idx !== lastIdx.current) {
      lastIdx.current = idx;
      setCenterIdx(idx);
    }
  }, [N, circ, reduce]);

  const animateTo = useCallback(
    (i: number) => {
      let d = i - pos.current;
      d = ((d % N) + N) % N;
      if (d > N / 2) d -= N;
      const target = pos.current + d;
      if (reduce) {
        pos.current = target;
        render();
        return;
      }
      if (raf.current) cancelAnimationFrame(raf.current);
      const start = pos.current;
      const delta = target - start;
      const t0 = performance.now();
      const dur = 420;
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
        pos.current = start + delta * e;
        render();
        if (p < 1) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    },
    [N, reduce, render],
  );

  const shift = useCallback((dir: number) => animateTo(Math.round(pos.current) + dir), [animateTo]);

  // Render whenever the overlay opens (after the cards exist in the DOM).
  useEffect(() => {
    if (!open) return;
    pos.current = 0;
    // -1 so the first render() detects the change to index 0 and syncs centerIdx
    // (avoids a synchronous setState in the effect body).
    lastIdx.current = -1;
    // next frame so refs are attached
    const id = requestAnimationFrame(render);
    return () => cancelAnimationFrame(id);
  }, [open, render]);

  // Body scroll lock + focus + key handling while open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const launcher = launchRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowLeft") shift(-1);
      else if (e.key === "ArrowRight") shift(1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      if (raf.current) cancelAnimationFrame(raf.current);
      launcher?.focus();
    };
  }, [open, shift]);

  const openReel = useCallback(
    (i: number) => {
      const w = reelWatchUrl(reels[i]?.url);
      if (w) window.open(w, "_blank", "noopener,noreferrer");
    },
    [reels],
  );

  // ---- pointer drag / tap ----
  // We use setPointerCapture for smooth dragging, which retargets the eventual
  // `click` to the stage — so the per-card onClick never fires. Instead we detect
  // a tap (no real movement) here and hit-test which card was under the pointer.
  const drag = useRef({ active: false, moved: false, startX: 0, startPos: 0, lastX: 0, lastT: 0, vel: 0 });
  const onDown = (e: React.PointerEvent) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    drag.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startPos: pos.current,
      lastX: e.clientX,
      lastT: performance.now(),
      vel: 0,
    };
    stageRef.current?.classList.add("dragging");
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const dg = drag.current;
    if (!dg.active) return;
    const dx = e.clientX - dg.startX;
    if (Math.abs(dx) > 6) dg.moved = true;
    pos.current = dg.startPos - dx / SPACING;
    const now = performance.now();
    const dt = now - dg.lastT || 16;
    dg.vel = (e.clientX - dg.lastX) / dt;
    dg.lastX = e.clientX;
    dg.lastT = now;
    render();
  };
  const onUp = (e: React.PointerEvent) => {
    const dg = drag.current;
    if (!dg.active) return;
    dg.active = false;
    stageRef.current?.classList.remove("dragging");

    if (!dg.moved) {
      // A tap: open the center card, or bring a tapped side card to center.
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const item = el?.closest<HTMLElement>(".rc-item");
      const idx = item ? Number(item.dataset.idx) : Math.round(pos.current);
      if (Number.isFinite(idx)) {
        if (Math.abs(circ(idx)) < 0.5) openReel(idx);
        else animateTo(idx);
      }
      return;
    }

    const momentum = -dg.vel * 6;
    animateTo(Math.round(pos.current + momentum));
  };

  if (N === 0) return null;

  const peeks = reels.slice(0, 3);

  const overlay = (
    <div
      className="rc-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Saved reels"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="rc-stage-wrap">
        <div className="rc-head">
          <div className="rc-title">🎬 Saved Reels</div>
          <button ref={closeRef} type="button" className="rc-close" aria-label="Close" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>

        <div
          ref={stageRef}
          className="rc-stage"
          aria-roledescription="carousel"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {reels.map((r, i) => {
            const thumb = reelThumbUrl(r.url);
            return (
              <div
                key={r.id}
                data-idx={i}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                className="rc-item"
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="rc-thumb"
                    src={thumb}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    onError={(e) => {
                      // Broken thumbnail → swap to the branded fallback tile.
                      const img = e.currentTarget;
                      img.style.display = "none";
                      const fb = img.nextElementSibling as HTMLElement | null;
                      if (fb) fb.style.display = "grid";
                    }}
                  />
                ) : null}
                <div
                  className="rc-fallback"
                  style={{ background: grad(r.id), display: thumb ? "none" : "grid" }}
                  aria-hidden
                >
                  <span className="play">▶</span>
                </div>
                <div className="rc-cap">{r.title}</div>
              </div>
            );
          })}
        </div>

        <div className="rc-arrows">
          <button type="button" className="rc-arrow l" aria-label="Previous" onClick={() => shift(-1)}>
            ‹
          </button>
          <button type="button" className="rc-arrow r" aria-label="Next" onClick={() => shift(1)}>
            ›
          </button>
        </div>

        <div className="rc-capout">
          <div className="ct">{reels[centerIdx]?.title}</div>
          <div className="co">Tap the center card to open on YouTube</div>
        </div>

        <div className="rc-dots" aria-hidden>
          {reels.map((r, i) => (
            <span key={r.id} className={"rc-dot" + (i === centerIdx ? " on" : "")} />
          ))}
        </div>

        <div className="rc-hint">Swipe or drag · ‹ › · Esc to close</div>
      </div>
    </div>
  );

  return (
    <>
      <button ref={launchRef} type="button" className="rc-card" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span className="rc-peek" aria-hidden>
          {peeks.map((r) => {
            const t = reelThumbUrl(r.url);
            return <i key={r.id} style={{ background: t ? `center/cover url(${t})` : grad(r.id) }} />;
          })}
        </span>
        <span className="rc-meta">
          <span className="h">
            🎬 Saved Reels <span className="rc-count">{N}</span>
          </span>
          <span className="s">Your bookmarked clips — flip through them</span>
        </span>
        <span className="rc-chev" aria-hidden>
          ›
        </span>
      </button>

      {open ? createPortal(overlay, document.body) : null}
    </>
  );
}
