"use client";

// TEMP local visual-QA harness for rapid fire (no auth, stubbed DB write).
// Delete this route + the /dev-preview allowance in lib/supabase/middleware.ts.
import { useState } from "react";
import { RF1, RF2, RAPIDFIRE_XP } from "@/content";
import { RapidFireRunner } from "@/components/rapidfire/RapidFireRunner";
import type { CompleteRapidFireResult } from "@/app/(app)/learn/rf/[id]/actions";

const SETS = { rf1: RF1, rf2: RF2 } as const;

export default function RapidFirePreview() {
  const [key, setKey] = useState<keyof typeof SETS>("rf1");
  const set = SETS[key];

  async function stubComplete(
    _rfId: string,
    correctCount: number,
  ): Promise<CompleteRapidFireResult> {
    const passed = correctCount >= set.passThreshold;
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

  return (
    <div>
      <div style={{ position: "fixed", top: 8, left: 8, zIndex: 50, display: "flex", gap: 6 }}>
        {(Object.keys(SETS) as (keyof typeof SETS)[]).map((k) => (
          <button
            key={k}
            onClick={() => setKey(k)}
            style={{
              fontSize: 11,
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: key === k ? "#0d9488" : "#fff",
              color: key === k ? "#fff" : "#333",
            }}
          >
            {k}
          </button>
        ))}
      </div>
      <RapidFireRunner key={key} set={set} completeAction={stubComplete} />
    </div>
  );
}
