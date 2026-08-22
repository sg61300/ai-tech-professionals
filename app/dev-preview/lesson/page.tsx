"use client";

// TEMP local visual-QA harness for the lesson runner (no auth, stubbed write).
// Delete this route + the /dev-preview allowance in lib/supabase/middleware.ts.
import { useState } from "react";
import { LESSONS } from "@/content";
import { LessonRunner } from "@/components/lesson/LessonRunner";
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
  const lesson = LESSONS.find((l) => l.id === id) ?? LESSONS[0];
  return (
    <div>
      <div style={{ position: "fixed", top: 8, left: 8, zIndex: 50, display: "flex", gap: 6 }}>
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
          </button>
        ))}
      </div>
      <LessonRunner key={lesson.id} lesson={lesson} completeAction={stubComplete} />
    </div>
  );
}
