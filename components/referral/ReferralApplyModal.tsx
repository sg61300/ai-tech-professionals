"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { applyReferralCode } from "@/app/actions/referral";
import { APPLY_ERRORS } from "@/components/profile/ReferralCards";
import "./referral-modal.css";

/**
 * First-signup referral prompt (Session 23). Shown ONCE, right after a new user
 * finishes onboarding, ONLY when they weren't already attributed via an invite
 * link. A returning user who skipped it uses the Profile apply-card instead
 * (still gated to the pre-taste-sim value window) — this modal never reappears.
 *
 * Floating window over a blurred backdrop. Closes ONLY via the explicit controls
 * — ✕, "I don't have one", or Continue after applying — NOT a backdrop click or
 * Esc, so a stray click can't dismiss it and drop the code by accident (user
 * directive). Reuses `applyReferralCode(code, "signup")` for the same
 * apply-once / no-self / value-window guards.
 */
export function ReferralApplyModal({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await applyReferralCode(code.trim(), "signup");
    setBusy(false);
    if (res.ok) {
      // Show the confirmation and wait for the user to acknowledge (OK / ✕) —
      // never auto-close, so they always know the code registered.
      setApplied(true);
    } else {
      // Invalid / ineligible: show the reason under the input and keep the card
      // open so they can correct it (or skip / ✕ to continue).
      setError(APPLY_ERRORS[res.reason] ?? "Something went wrong. Try again.");
    }
  }

  return createPortal(
    <div className="rm-backdrop">
      <div className="rm-window" role="dialog" aria-modal="true" aria-labelledby="rm-title">
        <button className="rm-x" onClick={() => !busy && onDone()} aria-label="Close" disabled={busy}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none"
            stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="rm-ico" aria-hidden="true">🎁</div>

        {applied ? (
          <div className="rm-applied">
            <h2 className="rm-title">Code applied! 🎉</h2>
            <p className="rm-sub">
              Finish your taste simulation and the bonus XP lands for both of you.
            </p>
            <button type="button" className="rm-apply rm-continue" onClick={onDone}>
              Continue
            </button>
          </div>
        ) : (
          <>
            <h2 id="rm-title" className="rm-title">
              Have a referral code?
            </h2>
            <p className="rm-sub">
              A friend sent you here? Drop their code in now and you <b>both</b> earn bonus XP once
              you finish your first simulation.
            </p>

            <form className="rm-form" onSubmit={submit}>
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter code"
                aria-label="Referral code"
                autoCapitalize="characters"
                autoFocus
                className="rm-input"
              />
              <button type="submit" className="rm-apply" disabled={busy || !code.trim()}>
                {busy ? "…" : "Apply"}
              </button>
            </form>
            {error && <p className="rm-err">{error}</p>}

            <button type="button" className="rm-skip" onClick={() => !busy && onDone()} disabled={busy}>
              I don&apos;t have one
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
