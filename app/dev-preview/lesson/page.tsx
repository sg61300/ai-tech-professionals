"use client";

// TEMP local visual-QA harness for the lesson runner (no auth, stubbed write).
// Delete this route + the /dev-preview allowance in lib/supabase/middleware.ts.
import { useState } from "react";
import { LESSONS } from "@/content";
import { LessonRunner } from "@/components/lesson/LessonRunner";
import { flavorFor } from "@/lib/flavor";
import { SENIORITIES } from "@/content/schema";
import type { CompleteLessonResult } from "@/app/(app)/learn/lesson/[id]/actions";

// Stubbed completion: fakes a first-time success so the celebration renders.
async function stubComplete(_id: string, _correct: boolean): Promise<CompleteLessonResult> {
  return {
    ok: true,
    alreadyDone: false,
    xpAwarded: 20,
    leveledUp: false,
    newLevel: 1,
    streak: 1,
    streakAdvanced: true,
  };
}

export default function LessonPreview() {
  const [id, setId] = useState(LESSONS[0]?.id);
  // null = simulate a learner with no seniority set (flavor note should hide).
  const [seniority, setSeniority] = useState<string | null>(null);
  const lesson = LESSONS.find((l) => l.id === id) ?? LESSONS[0];
  const flavorNote = flavorFor(lesson.flavor, seniority);
  return (
    <div>
      <div
        style={{
          position: "fixed",
          top: 8,
          left: 8,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 360 }}>
          {LESSONS.map((l) => (
            <button
              key={l.id}
              onClick={() => setId(l.id)}
              style={{
                fontSize: 11,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid #ccc",
                background: id === l.id ? "#0d9488" : "#fff",
                color: id === l.id ? "#fff" : "#333",
              }}
            >
              {l.id}
              {l.flavor ? " 🎯" : ""}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["none", ...SENIORITIES] as const).map((s) => {
            const val = s === "none" ? null : s;
            const active = seniority === val;
            return (
              <button
                key={s}
                onClick={() => setSeniority(val)}
                style={{
                  fontSize: 11,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: active ? "#FB6F5A" : "#fff",
                  color: active ? "#fff" : "#333",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
      <LessonRunner
        key={`${lesson.id}-${seniority ?? "none"}`}
        lesson={lesson}
        flavorNote={flavorNote}
        completeAction={stubComplete}
      />
    </div>
  );
}
