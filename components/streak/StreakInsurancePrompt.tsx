"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveStreak } from "@/app/actions/streak-insurance";
import { RuneMascot } from "@/components/brand/RuneMascot";
import "./streakinsurance.css";

/**
 * Streak-insurance prompt (the mercy mechanic — lib/streakinsurance, ADR-002).
 * Shown on the Learn home only when the server computed the streak is savable
 * (missed 1–2 days). Explicit opt-in: the user chooses to spend XP; nothing is
 * auto-deducted. "Not now" hides it for this browser session (it returns on the
 * next visit while still at risk); a successful save refreshes the page, after
 * which the server no longer marks it at risk.
 */
export function StreakInsurancePrompt({
  streak,
  missedDays,
  cost,
  costPct,
  capReached = false,
}: {
  streak: number;
  missedDays: number;
  cost: number;
  costPct: number;
  /** Weekly save cap used up (Q7) — show the limit, no purchasable save. */
  capReached?: boolean;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("streaksave-dismissed") === "1";
    } catch {
      return false;
    }
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  async function onSave() {
    setSaving(true);
    setError(null);
    const res = await saveStreak();
    if (res.ok) {
      setSaved(true);
      // Let the success note show briefly, then refresh so the server drops the
      // prompt and the topbar XP reflects the spend.
      setTimeout(() => router.refresh(), 1200);
    } else if (res.error === "already_saved" || res.error === "not_at_risk") {
      // State changed under us — just refresh to the truth.
      router.refresh();
    } else if (res.error === "weekly_cap_reached") {
      setSaving(false);
      setError("You've used all your streak saves this week. It's back next week.");
    } else {
      setSaving(false);
      setError("Could not save your streak. Please try again.");
    }
  }

  function onDismiss() {
    try {
      sessionStorage.setItem("streaksave-dismissed", "1");
    } catch {
      /* private mode — dismiss for this render only */
    }
    setDismissed(true);
  }

  if (saved) {
    return (
      <div className="si-card si-ok" role="status">
        <div className="si-rune">
          <RuneMascot state="streak" spriteSrc="/mascot/rune-hero-clean.png" dimensions={64} />
        </div>
        <div className="si-body">
          <div className="si-title">Streak saved!</div>
          <div className="si-sub">Your {streak}-day streak lives on. Keep it going today.</div>
        </div>
      </div>
    );
  }

  const pct = Math.round(costPct * 100);
  const days = missedDays === 1 ? "a day" : `${missedDays} days`;

  // Weekly cap used up (Q7): still tell them honestly that the streak is at
  // risk, but there's no save to buy this week — no matter how much XP they have.
  if (capReached) {
    return (
      <div className="si-card" role="alert">
        <div className="si-rune">
          <RuneMascot state="streakAtRisk" spriteSrc="/mascot/rune-hero-clean.png" dimensions={64} />
        </div>
        <div className="si-body">
          <div className="si-title">Your {streak}-day streak is at risk!</div>
          <div className="si-sub">
            You missed {days}. You&apos;ve used all your streak saves this week, so they&apos;re back
            next week. Do a lesson today to keep it going for free.
          </div>
          <div className="si-actions">
            <button className="si-dismiss" onClick={onDismiss}>
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="si-card" role="alert">
      <div className="si-rune">
        <RuneMascot state="streakAtRisk" spriteSrc="/mascot/rune-hero-clean.png" dimensions={64} />
      </div>
      <div className="si-body">
        <div className="si-title">Your {streak}-day streak is at risk!</div>
        <div className="si-sub">
          You missed {days}. Spend <b>{cost} XP</b> ({pct}%) to keep your streak alive.
        </div>
        {error && <div className="si-err">{error}</div>}
        <div className="si-actions">
          <button className="si-save" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : `Save my streak · ${cost} XP`}
          </button>
          <button className="si-dismiss" onClick={onDismiss} disabled={saving}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
