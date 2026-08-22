"use client";

// TEMP local visual-QA harness for the onboarding flow (no auth, stubbed save).
// Delete this route + the /dev-preview allowance in lib/supabase/middleware.ts.
import { useState } from "react";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import type { OnboardingStep } from "@/lib/onboarding";

const STEPS: OnboardingStep[] = ["intro", "profession", "profile", "level"];

export default function OnboardingPreview() {
  const [start, setStart] = useState<OnboardingStep>("intro");
  return (
    <div>
      <div style={{ position: "fixed", top: 8, left: 8, zIndex: 50, display: "flex", gap: 6 }}>
        {STEPS.map((s) => (
          <button
            key={s}
            onClick={() => setStart(s)}
            style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid #ccc", background: start === s ? "#0d9488" : "#fff", color: start === s ? "#fff" : "#333" }}
          >
            {s}
          </button>
        ))}
      </div>
      <OnboardingFlow
        key={start}
        startStep={start}
        initial={{ name: "Priya", avatarName: "", mobile: "", avatarKey: "fox", seniority: "mid", aiComfort: null }}
        saveAction={async () => ({ ok: true })}
      />
    </div>
  );
}
