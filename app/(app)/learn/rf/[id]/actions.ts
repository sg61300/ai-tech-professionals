"use server";

import { revalidateProgress } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics/server";
import { EVENTS } from "@/lib/analytics/events";
import { applyXp } from "@/lib/xp";
import { computeStreak } from "@/lib/streak";
import { getRapidFire, RAPIDFIRE_XP } from "@/content";

export type CompleteRapidFireResult =
  | {
      ok: true;
      passed: boolean;
      alreadyDone: boolean;
      xpAwarded: number;
      leveledUp: boolean;
      newLevel: number;
      streak: number;
      streakAdvanced: boolean;
    }
  | { ok: false; error: string };

/**
 * Record a finished rapid-fire round. Reuses `lesson_progress` (id = the RF id)
 * so passing flows straight into the `completed` set that gates the sim node —
 * no extra table. Idempotent: a row is only written on the FIRST pass, and XP
 * (a fixed RAPIDFIRE_XP — the in-round tally is cosmetic, never trusted from the
 * client) + the tz-aware streak are awarded once. Failing (< pass threshold)
 * writes nothing and is infinitely, friendly-y retryable (PRD/11).
 *
 * `correctCount` is stored as the score for later tuning; it does not affect the
 * XP award.
 */
export async function completeRapidFire(
  rfId: string,
  correctCount: number,
): Promise<CompleteRapidFireResult> {
  const set = getRapidFire(rfId);
  if (!set) return { ok: false, error: "Unknown rapid fire" };

  const passed = correctCount >= set.passThreshold;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("xp, streak_count, longest_streak, last_active_date, timezone")
    .eq("id", user.id)
    .single();
  if (!profile) return { ok: false, error: "No profile" };

  // Analytics fire on every attempt (pass or fail) so we can see the retry rate.
  await captureServer(user.id, EVENTS.RAPIDFIRE_COMPLETED, {
    rf_id: rfId,
    passed,
    correct: Math.max(0, Math.floor(correctCount)),
  });

  // A failed round records nothing — retry is free and unlimited.
  if (!passed) {
    return {
      ok: true,
      passed: false,
      alreadyDone: false,
      xpAwarded: 0,
      leveledUp: false,
      newLevel: applyXp(profile.xp, 0).level,
      streak: profile.streak_count,
      streakAdvanced: false,
    };
  }

  // Idempotency: only the first pass awards XP / advances the streak.
  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("status")
    .eq("user_id", user.id)
    .eq("lesson_id", rfId)
    .maybeSingle();
  const alreadyDone = existing?.status === "done";

  await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: rfId,
      status: "done",
      score: Math.max(0, Math.floor(correctCount)),
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" },
  );

  if (alreadyDone) {
    revalidateProgress();
    return {
      ok: true,
      passed: true,
      alreadyDone: true,
      xpAwarded: 0,
      leveledUp: false,
      newLevel: applyXp(profile.xp, 0).level,
      streak: profile.streak_count,
      streakAdvanced: false,
    };
  }

  const xpResult = applyXp(profile.xp, RAPIDFIRE_XP);
  const streakResult = computeStreak({
    lastActiveDate: profile.last_active_date,
    now: new Date(),
    timeZone: profile.timezone ?? "Asia/Kolkata",
    currentStreak: profile.streak_count,
  });

  const patch: Record<string, unknown> = { xp: xpResult.xp, level: xpResult.level };
  if (streakResult.isNewDay) {
    patch.streak_count = streakResult.newStreak;
    patch.longest_streak = Math.max(profile.longest_streak, streakResult.newStreak);
    patch.last_active_date = streakResult.today;
    await supabase
      .from("daily_activity")
      .upsert(
        { user_id: user.id, activity_date: streakResult.today },
        { onConflict: "user_id,activity_date", ignoreDuplicates: true },
      );
  }
  await supabase.from("profiles").update(patch).eq("id", user.id);

  if (xpResult.leveledUp) await captureServer(user.id, EVENTS.LEVEL_UP, { level: xpResult.level });
  if (streakResult.isNewDay && streakResult.isConsecutive) {
    await captureServer(user.id, EVENTS.STREAK_ADVANCED, { streak: streakResult.newStreak });
  }

  revalidateProgress();

  return {
    ok: true,
    passed: true,
    alreadyDone: false,
    xpAwarded: RAPIDFIRE_XP,
    leveledUp: xpResult.leveledUp,
    newLevel: xpResult.level,
    streak: streakResult.isNewDay ? streakResult.newStreak : profile.streak_count,
    streakAdvanced: streakResult.isNewDay && streakResult.isConsecutive,
  };
}
