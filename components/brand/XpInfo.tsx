"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { cumXpForLevel } from "@/lib/xp";
import "./xpinfo.css";

/**
 * Shared XP explainer dialog (portaled to <body> to escape any parent stacking
 * context). Explains what XP is and does: it levels you up via the "AI
 * Awesomeness Progression", and can be spent to save your streak; no
 * leaderboards. Used by both the topbar pill (XpInfo) and the profile XP meter
 * (XpProgress).
 */
function XpDialog({ level, xp, onClose }: { level: number; xp: number; onClose: () => void }) {
  if (typeof document === "undefined") return null;
  // XP still needed to climb into the next tier (for the plain-English explainer).
  const toNextTier = Math.max(0, cumXpForLevel(level + 1) - xp);
  return createPortal(
    <div className="xpi-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="xpi-card" onClick={(e) => e.stopPropagation()}>
        <div className="xpi-head">
          <span className="xpi-ic">⭐</span>
          <h3 className="xpi-title">Your XP</h3>
          <button className="xpi-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="xpi-lead">
          XP is your momentum. You&apos;re at <b>{xp.toLocaleString()} XP</b>, tier <b>{level}</b>.
        </p>
        <p className="xpi-tier">
          A <b>tier</b> is simply your XP rank, like belts in a game. It climbs as you learn.
          {toNextTier > 0 && (
            <>
              {" "}Just <b>{toNextTier.toLocaleString()} XP</b> more to reach tier <b>{level + 1}</b>.
            </>
          )}
        </p>
        <ul className="xpi-list">
          <li>
            <b>Earn it</b> by finishing lessons, simulations and rapid fire.
          </li>
          <li>
            <b>It levels you up</b>: XP fills your <b>AI Awesomeness Progression</b>.
          </li>
          <li>
            <b>Spend it to save your streak</b>: miss a day and you can trade some XP to keep your
            streak alive.
          </li>
          <li>No leaderboards, no pressure. XP is just your own progress.</li>
        </ul>
        <button className="xpi-ok" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** The topbar XP pill — pulses to invite a tap, opens the XP explainer. */
export function XpInfo({ level, xp }: { level: number; xp: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="xp xp-pulse"
        onClick={() => setOpen(true)}
        aria-label="What is XP? Open explainer"
      >
        ⭐ {level} · {xp.toLocaleString()} XP
      </button>
      {open && <XpDialog level={level} xp={xp} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * The profile "AI Awesomeness Progression" meter — same blink + explainer as the
 * dashboard XP pill, rendered as the label + XP + progress bar the profile uses.
 */
export function XpProgress({ level, xp, progress }: { level: number; xp: number; progress: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="pf-xp pf-xp-btn xp-pulse"
        onClick={() => setOpen(true)}
        aria-label="What is XP? Open explainer"
      >
        <span className="pf-xp-row">
          <span>AI Awesomeness Progression · {level}</span>
          <span>{xp.toLocaleString()} XP</span>
        </span>
        <span className="pf-bar">
          <i style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
      </button>
      {open && <XpDialog level={level} xp={xp} onClose={() => setOpen(false)} />}
    </>
  );
}
