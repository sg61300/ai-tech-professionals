"use client";

// TEMP local visual-QA harness for the taste sim (no auth, stubbed AI + write).
// Delete this route + the /dev-preview allowance in lib/supabase/middleware.ts.
import { tasteSim } from "@/content";
import { TasteSimRunner } from "@/components/sim/TasteSimRunner";
import type { TasteGenResult, TasteCompleteResult } from "@/app/(app)/learn/sim/[id]/actions";

async function stubGenerate(): Promise<TasteGenResult> {
  await new Promise((r) => setTimeout(r, 900)); // show the "Rune is tuning" loader
  return { ok: true, text: tasteSim.fallbackOutput, source: "live" };
}
async function stubComplete(): Promise<TasteCompleteResult> {
  return {
    ok: true,
    alreadyDone: false,
    xpAwarded: tasteSim.xp,
    leveledUp: false,
    newLevel: 1,
    streak: 1,
    streakAdvanced: true,
    badge: tasteSim.badge,
  };
}

export default function TasteSimPreview() {
  return <TasteSimRunner sim={tasteSim} generateAction={stubGenerate} completeAction={stubComplete} />;
}
