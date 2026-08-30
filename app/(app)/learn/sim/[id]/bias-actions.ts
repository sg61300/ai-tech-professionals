"use server";

import { z } from "zod";
import { revalidateProgress } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics/server";
import { EVENTS } from "@/lib/analytics/events";
import { callJsonAI } from "@/lib/ai/json";
import { buildScreenPrompt } from "@/lib/ai/prompts";
import { guardInput } from "@/lib/inputguard";
import { applyXp } from "@/lib/xp";
import { computeStreak } from "@/lib/streak";
import { biasSim } from "@/content";
import {
  buildRankSchema,
  biasRankGolden,
  selectedFixEffects,
  type BiasRankItem,
} from "@/lib/biassim";

/**
 * The client tells us which fix toggles it selected (ids only) plus an optional
 * guarded job title. We filter toggle ids to the sim's own (tamper-safe), derive
 * the phase (no fixes → naive round 1; fixes → fair round 2), build an
 * authored-content prompt, and screen via callJsonAI (permutation-validated, with
 * the golden ranking as the guaranteed fallback). DPDP: raw title is transient.
 */
const ScreenInputSchema = z.object({
  fixToggleIds: z.array(z.string()).max(20).optional(),
  jobTitle: z.string().optional(),
});

export type ScreenResult = { ranking: BiasRankItem[]; source: "live" | "fallback" };

export async function screenCandidates(input: unknown): Promise<ScreenResult> {
  const parsed = ScreenInputSchema.safeParse(input);
  const okToggleIds = new Set(biasSim.fixToggles.map((t) => t.id));
  const fixToggleIds = (parsed.success ? parsed.data.fixToggleIds ?? [] : []).filter((id) =>
    okToggleIds.has(id),
  );
  const phase = fixToggleIds.length > 0 ? "fair" : "biased";
  const golden = biasRankGolden(biasSim, phase);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ranking: golden.ranking, source: "fallback" };

  // Optional free-text job title: re-guard on the server (client checks are UX only).
  let jobTitle: string | undefined;
  if (parsed.success && parsed.data.jobTitle && parsed.data.jobTitle.trim().length > 0) {
    const guard = guardInput(parsed.data.jobTitle);
    if (guard.ok) jobTitle = guard.normalized;
  }

  const fixEffects = selectedFixEffects(biasSim, fixToggleIds);
  const prompt = buildScreenPrompt(biasSim, { jobTitle, fixEffects });

  const { data, source } = await callJsonAI({
    req: { prompt, maxOutputTokens: 500 },
    golden,
    schema: buildRankSchema(biasSim),
  });
  if (source === "fallback") {
    await captureServer(user.id, EVENTS.AI_FALLBACK_USED, { surface: "bias_sim" });
  }
  return { ranking: data.ranking, source };
}

export type BiasCompleteResult =
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
 * Record the finished Bias Catcher — the L1 capstone FULL sim. Mirrors
 * completeSystemSim: node-ledger row + `sim_completions` (is_full=TRUE), saves a
 * "fair screening" artifact to the second brain, awards XP, advances the streak.
 * Idempotent via the sim_completions existence check.
 */
export async function completeBiasSim(): Promise<BiasCompleteResult> {
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

  await supabase.from("lesson_progress").upsert(
    { user_id: user.id, lesson_id: biasSim.id, status: "done", completed_at: new Date().toISOString() },
    { onConflict: "user_id,lesson_id" },
  );

  const { data: prior } = await supabase
    .from("sim_completions")
    .select("id")
    .eq("user_id", user.id)
    .eq("sim_id", biasSim.id)
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
      badge: biasSim.badge,
    };
  }

  const fairRubric = [
    "My fair screening rubric:",
    ...biasSim.fixToggles.filter((t) => t.debiasing).map((t) => `- ${t.effect}`),
  ].join("\n");

  const { data: artifact } = await supabase
    .from("saved_artifacts")
    .insert({
      user_id: user.id,
      title: "My fair screening rubric",
      source_sim: biasSim.id,
      body: fairRubric,
    })
    .select("id")
    .maybeSingle();

  await supabase.from("sim_completions").insert({
    user_id: user.id,
    sim_id: biasSim.id,
    is_full: true,
    artifact_id: artifact?.id ?? null,
    rubric_json: { sim: biasSim.id },
  });

  const xpResult = applyXp(profile.xp, biasSim.xp);
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

  await captureServer(user.id, EVENTS.FULL_SIM_COMPLETED, { sim_id: biasSim.id });
  if (xpResult.leveledUp) await captureServer(user.id, EVENTS.LEVEL_UP, { level: xpResult.level });
  if (streakResult.isNewDay && streakResult.isConsecutive) {
    await captureServer(user.id, EVENTS.STREAK_ADVANCED, { streak: streakResult.newStreak });
  }

  revalidateProgress();

  return {
    ok: true,
    alreadyDone: false,
    xpAwarded: biasSim.xp,
    leveledUp: xpResult.leveledUp,
    newLevel: xpResult.level,
    streak: streakResult.isNewDay ? streakResult.newStreak : profile.streak_count,
    streakAdvanced: streakResult.isNewDay && streakResult.isConsecutive,
    badge: biasSim.badge,
  };
}
