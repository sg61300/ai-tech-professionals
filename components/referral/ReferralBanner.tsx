"use client";

import { useState, useTransition } from "react";
import { markReferralRewardsSeen } from "@/app/actions/referral";
import "./referral-banner.css";

/**
 * Persisted referrer-reward notifier (Session 23). Rendered on /learn when the
 * signed-in user has UNSEEN granted referral rewards. The referrer earns XP from
 * the invitee's session (cross-user credit) and is almost never in the app when
 * it fires, so this waits for them on their next visit. Dismiss marks every
 * unseen reward seen (server) so it never repeats.
 *
 * The invitee side is separate: they get an inline line on their own taste-sim
 * celebration (TasteSimRunner), where they already are.
 */
export function ReferralBanner({ title, subtitle }: { title: string; subtitle: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [, startTransition] = useTransition();

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true); // optimistic — the reward is real either way
    startTransition(() => {
      void markReferralRewardsSeen();
    });
  }

  // Emphasize the "+NNN XP" amount without the pure copy function needing to know
  // about markup. Falls back to the plain title if the pattern ever changes.
  const m = title.match(/^(.*?)(\+\d[\d,]*\s*XP)(.*)$/);

  return (
    <div className="rb-wrap" role="status">
      <span className="rb-spark s1">✦</span>
      <span className="rb-spark s2 teal">✦</span>
      <span className="rb-spark s3 coral">✧</span>
      <span className="rb-spark s4">✦</span>
      <span className="rb-spark s5 teal">✧</span>
      <span className="rb-spark s6 coral">✦</span>
      <div className="rb-card">
        <div className="rb-ico" aria-hidden="true">🎁</div>
        <div className="rb-body">
          <p className="rb-title">
            {m ? (
              <>
                {m[1]}
                <span className="rb-amt">{m[2]}</span>
                {m[3]}
              </>
            ) : (
              title
            )}
          </p>
          <p className="rb-sub">{subtitle}</p>
        </div>
        <button className="rb-x" onClick={dismiss} aria-label="Dismiss">
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none"
            stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
