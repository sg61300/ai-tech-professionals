"use client";

// TEMP local visual-QA harness for the streak calendar (no auth, fake data).
// Delete this route + the /dev-preview allowance in lib/supabase/middleware.ts.
import { StreakCalendar } from "@/components/streak/StreakCalendar";

export default function StreakPreview() {
  return (
    <div className="lh">
      <StreakCalendar
        currentStreak={7}
        bestStreak={7}
        today="2026-08-21"
        joinDate="2026-08-15"
        activeDates={[
          "2026-08-15",
          "2026-08-16",
          "2026-08-18",
          "2026-08-19",
          "2026-08-20",
          "2026-08-21",
        ]}
      />
    </div>
  );
}
