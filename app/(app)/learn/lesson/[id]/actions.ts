"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics/server";
import { EVENTS } from "@/lib/analytics/events";
import { applyXp } from "@/lib/xp";
import { computeStreak } from "@/lib/streak";
import { isLessonId, LESSON_XP } from "@/content";

export type CompleteLessonResult =
  | {
      ok: true;
      alreadyDone: boolean;
      xpAwarded: number;
      leveledUp: boolean;
      newLevel: number;
      streak: number;
      streakAdvanced: boolean;
    }
  | { ok: false; error: string };

/**
 * Record a finished lesson. The single write-point of the activation spine:
 * upserts `lesson_progress`, awards XP (level-up detection), and advances the
 * tz-aware streak (`daily_activity` + profile), all keyed to the auth uid and
 * gated by owner-only RLS. Idempotent: replaying a done lesson never
 * double-awards XP or bumps the streak again (IMPLEMENTATION-PLAN §3.5).
 */
export async function completeLesson(
  lessonId: string,
  correct: boolean,
): Promise<CompleteLessonResult> {
  if (!isLessonId(lessonId)) return { ok: false, error: "Unknown lesson" };

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

  // Idempotency: if this lesson is already done, don't re-award anything.
  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("status")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  const alreadyDone = existing?.status === "done";

  const score = correct ? 100 : 60;

  // Always upsert the row (records the latest score / marks it done).
  await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      status: "done",
      score,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" },
  );

  if (alreadyDone) {
    return {
      ok: true,
      alreadyDone: true,
      xpAwarded: 0,
      leveledUp: false,
      newLevel: applyXp(profile.xp, 0).level,
      streak: profile.streak_count,
      streakAdvanced: false,
    };
  }

  // Award XP (first completion only).
  const xpResult = applyXp(profile.xp, LESSON_XP);

  // Advance the tz-aware streak. Only touch streak state on a genuinely new day.
  const streakResult = computeStreak({
    lastActiveDate: profile.last_active_date,
    now: new Date(),
    timeZone: profile.timezone ?? "Asia/Kolkata",
    currentStreak: profile.streak_count,
  });

  const profilePatch: Record<string, unknown> = {
    xp: xpResult.xp,
    level: xpResult.level,
  };
  if (streakResult.isNewDay) {
    profilePatch.streak_count = streakResult.newStreak;
    profilePatch.longest_streak = Math.max(profile.longest_streak, streakResult.newStreak);
    profilePatch.last_active_date = streakResult.today;

    // Record the day (powers the streak strip + north-star "returned" query).
    await supabase
      .from("daily_activity")
      .upsert(
        { user_id: user.id, activity_date: streakResult.today },
        { onConflict: "user_id,activity_date", ignoreDuplicates: true },
      );
  }

  await supabase.from("profiles").update(profilePatch).eq("id", user.id);

  // Analytics (never log raw user text — DPDP).
  await captureServer(user.id, EVENTS.LESSON_COMPLETED, { lesson_id: lessonId, correct });
  if (xpResult.leveledUp) {
    await captureServer(user.id, EVENTS.LEVEL_UP, { level: xpResult.level });
  }
  if (streakResult.isNewDay && streakResult.isConsecutive) {
    await captureServer(user.id, EVENTS.STREAK_ADVANCED, { streak: streakResult.newStreak });
  }

  revalidatePath("/learn");

  return {
    ok: true,
    alreadyDone: false,
    xpAwarded: LESSON_XP,
    leveledUp: xpResult.leveledUp,
    newLevel: xpResult.level,
    streak: streakResult.isNewDay ? streakResult.newStreak : profile.streak_count,
    streakAdvanced: streakResult.isNewDay && streakResult.isConsecutive,
  };
}
