"use server";

import { z } from "zod";
import { revalidateProgress } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics/server";
import { EVENTS } from "@/lib/analytics/events";
import { applyXp } from "@/lib/xp";
import { computeStreak } from "@/lib/streak";
import { ensureSimArtifact } from "@/lib/sim/artifact";
import { systemSim } from "@/content";
import { getSample, buildArtifactBody, validateGeneratedXray, closestPreset } from "@/lib/systemsim";
import { callAI } from "@/lib/ai";
import { extractJson } from "@/lib/ai/json";
import { buildXrayGraphPrompt } from "@/lib/ai/prompts";
import { guardInput } from "@/lib/inputguard";
import { SystemSimSchema } from "@/content/schema";
import type { SysSample } from "@/content/schema";

const InputSchema = z.object({
  sampleId: z.string().optional(),
  /** A client-held generated graph (describe-your-own). Re-validated server-side. */
  generated: z.unknown().optional(),
});

/** The element schema for a single sample (shape-check for a client-sent generated graph). */
const SampleShape = SystemSimSchema.shape.samples.element;

export type XrayGenResult = { sample: SysSample; source: "live" | "fallback" };

/**
 * Describe-your-own X-Ray generation (spec §4.2b). The one guarded free-text
 * seam on the server side: we RE-RUN `guardInput` (client checks are UX only),
 * build an authored-scaffold prompt around the normalized workflow TYPE, call the
 * model for structured nodes/edges, then hard-validate + derive mermaid. On a
 * block, quota/timeout, or any invalid graph we return the closest preset,
 * labelled a sample. DPDP: the raw text is transient and never logged.
 */
export async function generateXray(input: unknown): Promise<XrayGenResult> {
  const parsed = z.object({ workflowType: z.string() }).safeParse(input);
  const raw = parsed.success ? parsed.data.workflowType : "";
  const guard = guardInput(raw);
  const fallbackSample = closestPreset(systemSim, guard.ok ? guard.normalized : raw);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { sample: fallbackSample, source: "fallback" };

  // Blocked by the guardrail → never call the model; hand back the closest preset.
  if (!guard.ok) {
    await captureServer(user.id, EVENTS.AI_FALLBACK_USED, { surface: "system_sim_generate" });
    return { sample: fallbackSample, source: "fallback" };
  }

  const prompt = buildXrayGraphPrompt(guard.normalized);
  const { text, source } = await callAI({ prompt, maxOutputTokens: 900 }, "");
  const graph = source === "live" ? validateGeneratedXray(extractJson(text)) : null;
  if (!graph) {
    await captureServer(user.id, EVENTS.AI_FALLBACK_USED, { surface: "system_sim_generate" });
    return { sample: fallbackSample, source: "fallback" };
  }
  return { sample: graph, source: "live" };
}

/** Resolve the sample to complete: a known preset id, or a re-validated generated graph. */
function resolveSample(parsed: z.infer<typeof InputSchema>): SysSample | undefined {
  if (parsed.sampleId) {
    const preset = getSample(systemSim, parsed.sampleId);
    if (preset) return preset;
  }
  if (parsed.generated !== undefined) {
    const reparsed = SampleShape.safeParse(parsed.generated);
    if (reparsed.success) return reparsed.data;
  }
  return undefined;
}

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
  const sample = parsed.success ? resolveSample(parsed.data) : undefined;
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

  // Second-brain artifact — also on the already-done path, so re-finishing
  // backfills a missing one.
  const artifactId = await ensureSimArtifact(supabase, user.id, {
    simId: systemSim.id,
    title: `${sample.label} X-ray`,
    body: buildArtifactBody(sample),
  });

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

  await supabase.from("sim_completions").insert({
    user_id: user.id,
    sim_id: systemSim.id,
    is_full: true,
    artifact_id: artifactId,
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
