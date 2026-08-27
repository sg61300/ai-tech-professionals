"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics/server";
import { EVENTS } from "@/lib/analytics/events";
import { revalidateProgress } from "@/lib/revalidate";
import { callAI } from "@/lib/ai";
import { buildTastePrompt } from "@/lib/ai/prompts";
import { applyXp } from "@/lib/xp";
import { computeStreak } from "@/lib/streak";
import { tasteSim } from "@/content";
import { grantReferralReward } from "@/app/actions/referral";

const SelectionsSchema = z.object({
  roleIndex: z.number().int(),
  factIndices: z.array(z.number().int()).max(20),
  toggleIndices: z.array(z.number().int()).max(20),
});

export type TasteGenResult =
  | { ok: true; text: string; source: "live" | "fallback" }
  | { ok: false; error: string };

/**
 * Generate the taste-sim email. The prompt is assembled server-side from the
 * user's curated selections (indices only — never free text), then run through
 * `callAI`, which guarantees a scripted fallback on error/timeout/quota so the
 * sim never dead-ends. Auth-gated because it spends Gemini quota.
 */
export async function generateTasteEmail(input: unknown): Promise<TasteGenResult> {
  const parsed = SelectionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid selections" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const prompt = buildTastePrompt(tasteSim, parsed.data);
  const { text, source } = await callAI({ prompt, maxOutputTokens: 450 }, tasteSim.fallbackOutput);

  // Watch the fallback rate on free-tier quota (plan §6). Never log the prompt/text (DPDP).
  if (source === "fallback") {
    await captureServer(user.id, EVENTS.AI_FALLBACK_USED, { surface: "taste_sim" });
  }

  return { ok: true, text, source };
}

export type TasteCompleteResult =
  | {
      ok: true;
      alreadyDone: boolean;
      xpAwarded: number;
      leveledUp: boolean;
      newLevel: number;
      streak: number;
      streakAdvanced: boolean;
      badge: string;
      /** Referral bonus the invitee just earned (0 if not referred / payouts off). Drives the inline celebration line. */
      referralXp: number;
    }
  | { ok: false; error: string };

/**
 * Record the finished taste sim: insert a `sim_completions` row (is_full=false
 * — the taste is a leading indicator, NOT the north-star full sim), award its
 * XP, and advance the tz-aware streak. Idempotent via an existence check
 * (sim_completions has no unique key). Badge is shown from content but not yet
 * persisted (no badges store until the Profile slice).
 */
export async function completeTasteSim(): Promise<TasteCompleteResult> {
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

  const { data: prior } = await supabase
    .from("sim_completions")
    .select("id")
    .eq("user_id", user.id)
    .eq("sim_id", tasteSim.id)
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
      badge: tasteSim.badge,
      referralXp: 0,
    };
  }

  await supabase
    .from("sim_completions")
    .insert({ user_id: user.id, sim_id: tasteSim.id, is_full: false });

  const xpResult = applyXp(profile.xp, tasteSim.xp);
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

  await captureServer(user.id, EVENTS.TASTE_SIM_COMPLETED, { sim_id: tasteSim.id });

  // Referral reward fires on the invitee's first taste sim (their first real
  // value) — pays both sides if this user was referred (ADR-020). Flag-gated,
  // idempotent, cross-user credit handled inside. Best-effort: never block the
  // completion response on it. The returned amount (if any) drives the invitee's
  // inline "you both earned it" celebration line (Session 23 notifier).
  const grant = await grantReferralReward(user.id);

  if (xpResult.leveledUp) await captureServer(user.id, EVENTS.LEVEL_UP, { level: xpResult.level });
  if (streakResult.isNewDay && streakResult.isConsecutive) {
    await captureServer(user.id, EVENTS.STREAK_ADVANCED, { streak: streakResult.newStreak });
  }

  revalidateProgress();

  return {
    ok: true,
    alreadyDone: false,
    xpAwarded: tasteSim.xp,
    leveledUp: xpResult.leveledUp,
    newLevel: xpResult.level,
    streak: streakResult.isNewDay ? streakResult.newStreak : profile.streak_count,
    streakAdvanced: streakResult.isNewDay && streakResult.isConsecutive,
    badge: tasteSim.badge,
    referralXp: grant.granted ? grant.xpEach : 0,
  };
}
