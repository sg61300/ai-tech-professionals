"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { unlockSimWithXp } from "@/app/actions/sim-unlock";
import "./sims.css";

/**
 * One simulation card on the Simulations-by-Level screen
 * (Design/xp-sim-unlock-spec.md §8). Rendered per state:
 *  - completed / open → an [Open] link into the sim runner.
 *  - locked + affordable → an inline (never native) confirm to spend XP.
 *  - locked + not affordable → a disabled "Need N more XP" button.
 * Price and eligibility are re-derived server-side by unlockSimWithXp; this
 * component only mirrors the result and navigates.
 */

type SimState = "completed" | "open" | "locked";

export interface SimCardProps {
  simId: string;
  title: string;
  glyph?: string;
  blurb: string;
  state: SimState;
  price: number | null;
  xp: number;
}

/** Map the server error union to a short, human line. */
function messageFor(error: string): string {
  switch (error) {
    case "insufficient_xp":
      return "Not enough XP for this unlock.";
    case "not_signed_in":
      return "Please sign in again to unlock.";
    case "unknown_sim":
      return "This sim isn't available.";
    default:
      return "Couldn't unlock. Please try again.";
  }
}

export function SimCard({ simId, title, glyph, blurb, state, price, xp }: SimCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const affordable = price != null && xp >= price;
  const remaining = price != null ? xp - price : 0;
  const shortBy = price != null ? price - xp : 0;
  // ?from=sims tells the sim's Back button to return here (the Sims tab) rather
  // than the learn dashboard.
  const simHref = `/learn/sim/${simId}?from=sims`;

  const runUnlock = () => {
    setErr(null);
    startTransition(async () => {
      const r = await unlockSimWithXp(simId);
      // On success (or an idempotent already-unlocked/open), STAY on the Sims
      // tab: refresh pulls the new server state so this card re-renders as
      // "Open" (the user taps Open to enter). We do NOT auto-navigate into it.
      if (r.ok || r.error === "already_open" || r.error === "already_unlocked") {
        setConfirming(false);
        router.refresh();
        return;
      }
      setErr(messageFor(r.error));
      setConfirming(false);
      router.refresh();
    });
  };

  const isOpen = state === "completed" || state === "open";

  return (
    <article className={`sc sc-${state}`}>
      <div className="sc-head">
        <span className="sc-glyph" aria-hidden>
          {glyph ?? "🎮"}
          {state === "locked" && <span className="sc-glyph-lock" aria-hidden>🔒</span>}
        </span>
        <div className="sc-main">
          <div className="sc-titlerow">
            <h3 className="sc-title">{title}</h3>
            {state === "completed" && <span className="sc-chip sc-chip-done">✓ Completed</span>}
            {state === "open" && <span className="sc-chip sc-chip-open">Ready</span>}
            {state === "locked" && <span className="sc-chip sc-chip-locked">Locked</span>}
          </div>
          {blurb && <p className="sc-blurb">{blurb}</p>}
        </div>
      </div>

      {isOpen && (
        <div className="sc-actions">
          <Link href={simHref} className="sc-btn sc-btn-primary">
            Open <span className="sc-arrow" aria-hidden>→</span>
          </Link>
        </div>
      )}

      {state === "locked" && affordable && !confirming && (
        <div className="sc-actions">
          <button
            type="button"
            className="sc-btn sc-btn-primary"
            onClick={() => {
              setErr(null);
              setConfirming(true);
            }}
          >
            Unlock <span className="sc-price">⚡ {price} XP</span>
          </button>
        </div>
      )}

      {state === "locked" && affordable && confirming && (
        <div className="sc-confirm">
          <p className="sc-confirm-q">
            Unlock <b>{title}</b> for <b>{price} XP</b>? You&apos;ll have <b>{remaining} left</b>.
            Permanent, no refund.
          </p>
          <div className="sc-actions sc-actions-confirm">
            <button
              type="button"
              className="sc-btn sc-btn-ghost"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="sc-btn sc-btn-primary"
              onClick={runUnlock}
              disabled={pending}
            >
              {pending ? "Unlocking…" : "Unlock"}
            </button>
          </div>
        </div>
      )}

      {state === "locked" && !affordable && (
        <div className="sc-actions">
          <span className="sc-need">Need {shortBy} more XP</span>
        </div>
      )}

      {err && (
        <p className="sc-err" role="alert">
          {err}
        </p>
      )}
    </article>
  );
}

export default SimCard;
