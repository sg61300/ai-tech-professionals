"use client";

// TEMP local visual-QA harness for the System X-Ray sim (no auth, stubbed write).
// Delete this route + the /dev-preview allowance in lib/supabase/middleware.ts.
import { systemSim } from "@/content";
import { SystemSimRunner } from "@/components/sim/SystemSimRunner";
import type { SystemCompleteResult } from "@/app/(app)/learn/sim/[id]/system-actions";

async function stubComplete(): Promise<SystemCompleteResult> {
  return {
    ok: true,
    alreadyDone: false,
    xpAwarded: systemSim.xp,
    leveledUp: false,
    newLevel: 2,
    streak: 3,
    streakAdvanced: true,
    badge: systemSim.badge,
  };
}

export default function SystemSimPreview() {
  return <SystemSimRunner sim={systemSim} completeAction={stubComplete} />;
}
