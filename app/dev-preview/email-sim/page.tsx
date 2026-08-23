"use client";

// TEMP local visual-QA harness for the Inbox Tamer sim (no auth, stubbed AI + write).
// Delete this route + the /dev-preview allowance in lib/supabase/middleware.ts.
import { emailSim } from "@/content";
import { EmailSimRunner } from "@/components/sim/EmailSimRunner";
import type {
  SortNarrationResult,
  EmailCompleteResult,
} from "@/app/(app)/learn/sim/[id]/email-actions";

async function stubNarrate(): Promise<SortNarrationResult> {
  await new Promise((r) => setTimeout(r, 900)); // show the "Rune is tuning" loader
  return {
    text: "Sorted! Your resignation, the CEO's deadline and the ethics complaint all rose straight to the top — exactly where they belong.",
    source: "live",
  };
}
async function stubComplete(): Promise<EmailCompleteResult> {
  return {
    ok: true,
    alreadyDone: false,
    xpAwarded: emailSim.xp,
    leveledUp: true,
    newLevel: 2,
    streak: 2,
    streakAdvanced: true,
    badge: emailSim.badge,
    score: 4,
    total: 4,
  };
}

export default function EmailSimPreview() {
  return (
    <EmailSimRunner sim={emailSim} narrateAction={stubNarrate} completeAction={stubComplete} />
  );
}
