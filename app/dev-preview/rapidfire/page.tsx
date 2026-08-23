"use client";

// TEMP local visual-QA harness for rapid fire (no auth, stubbed DB write).
// Delete this route + the /dev-preview allowance in lib/supabase/middleware.ts.
import { RF1, RAPIDFIRE_XP } from "@/content";
import { RapidFireRunner } from "@/components/rapidfire/RapidFireRunner";
import type { CompleteRapidFireResult } from "@/app/(app)/learn/rf/[id]/actions";

async function stubComplete(
  _rfId: string,
  correctCount: number,
): Promise<CompleteRapidFireResult> {
  const passed = correctCount >= RF1.passThreshold;
  return {
    ok: true,
    passed,
    alreadyDone: false,
    xpAwarded: passed ? RAPIDFIRE_XP : 0,
    leveledUp: false,
    newLevel: 1,
    streak: 1,
    streakAdvanced: passed,
  };
}

export default function RapidFirePreview() {
  return <RapidFireRunner set={RF1} completeAction={stubComplete} />;
}
