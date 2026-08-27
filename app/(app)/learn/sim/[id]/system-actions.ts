"use server";

import { z } from "zod";
import { revalidateProgress } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics/server";
import { EVENTS } from "@/lib/analytics/events";
import { applyXp } from "@/lib/xp";
import { computeStreak } from "@/lib/streak";
import { systemSim } from "@/content";
import { getSample, buildArtifactBody } from "@/lib/systemsim";

const InputSchema = z.object({ sampleId: z.string() });

export type SystemCompleteResult =
  | {
      ok: true;
      alreadyDone: boolean;
      xpAwarded: number;
      leveledUp: boolean;
      newLevel: number;
      streak: number;
      streakAdvanced: boolean;
      badge: string;
    }
  | { ok: false; error: string };

/**
 * Record the finished System X-Ray — a north-star FULL sim. Saves the
 * diagram/edge-cases/requirements artifact to the second brain, inserts a
 * `sim_completions` row (is_full=TRUE), awards +120 XP + the badge, advances the
 * tz-aware streak, and writes a node-ledger `lesson_progress` row so the path
 * shows it done. Idempotent via the sim_completions existence check.
 */
export async function completeSystemSim(input: unknown): Promise<SystemCompleteResult> {
  const parsed = InputSchema.safeParse(input);
  const sample = parsed.success ? getSample(systemSim, parsed.data.sampleId) : undefined;
  if (!sample) return { ok: false, error: "Unknown system sample" };

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

  // Node-ledger row (idempotent) → Learn path shows this sim done.
  await supabase.from("lesson_progress").upsert(
    { user_id: user.id, lesson_id: systemSim.id, status: "done", completed_at: new Date().toISOString() },
    { onConflict: "user_id,lesson_id" },
  );

  const { data: prior } = await supabase
    .from("sim_completions")
    .select("id")
    .eq("user_id", user.id)
    .eq("sim_id", systemSim.id)
    .limit(1)
    .maybeSingle();
  const alreadyDone = !!prior;

  if (alreadyDone) {
    return {
      ok: true,
      alreadyDone: true,
      xpAwarded: 0,
      leveledUp: false,
      newLevel: applyXp(profile.xp, 0).level,
      streak: profile.streak_count,
      streakAdvanced: false,
      badge: systemSim.badge,
    };
  }

  const { data: artifact } = await supabase
    .from("saved_artifacts")
    .insert({
      user_id: user.id,
      title: `${sample.label} X-ray`,
      source_sim: systemSim.id,
      body: buildArtifactBody(sample),
    })
    .select("id")
    .maybeSingle();

  await supabase.from("sim_completions").insert({
    user_id: user.id,
    sim_id: systemSim.id,
    is_full: true,
    artifact_id: artifact?.id ?? null,
    rubric_json: { sample: sample.id },
  });

  const xpResult = applyXp(profile.xp, systemSim.xp);
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

  await captureServer(user.id, EVENTS.FULL_SIM_COMPLETED, { sim_id: systemSim.id });
  if (xpResult.leveledUp) await captureServer(user.id, EVENTS.LEVEL_UP, { level: xpResult.level });
  if (streakResult.isNewDay && streakResult.isConsecutive) {
    await captureServer(user.id, EVENTS.STREAK_ADVANCED, { streak: streakResult.newStreak });
  }

  revalidateProgress();

  return {
    ok: true,
    alreadyDone: false,
    xpAwarded: systemSim.xp,
    leveledUp: xpResult.leveledUp,
    newLevel: xpResult.level,
    streak: streakResult.isNewDay ? streakResult.newStreak : profile.streak_count,
    streakAdvanced: streakResult.isNewDay && streakResult.isConsecutive,
    badge: systemSim.badge,
  };
}
