"use server";

import { z } from "zod";
import { revalidateProgress } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics/server";
import { EVENTS } from "@/lib/analytics/events";
import { callAI } from "@/lib/ai";
import { callJsonAI } from "@/lib/ai/json";
import { buildSortNarrationPrompt, buildInboxCoachPrompt } from "@/lib/ai/prompts";
import { applyXp } from "@/lib/xp";
import { computeStreak } from "@/lib/streak";
import { emailSim } from "@/content";
import { EMAIL_BUCKETS } from "@/content/schema";
import {
  classifyInbox,
  groupByBucket,
  compilePrompt,
  gradeRulebook,
  topEmails,
  inboxCoachGolden,
  sanitizeTopReasons,
  InboxCoachSchema,
  type InboxTopReason,
} from "@/lib/emailsim";
import type { EmailRule } from "@/content/schema";

/**
 * The client sends its rulebook as {conditionId, bucketKey} pairs. We validate
 * shape here, then filter to conditions/buckets that actually exist in the
 * authored sim — a tampered client can never inject anything but our own ids.
 */
const RuleSchema = z.object({
  conditionId: z.string(),
  bucketKey: z.enum(EMAIL_BUCKETS),
});
const RulesSchema = z.array(RuleSchema).max(50);

function sanitize(rules: EmailRule[]): EmailRule[] {
  const okCondition = new Set(emailSim.conditions.map((c) => c.id));
  return rules.filter((r) => okCondition.has(r.conditionId));
}

export type SortNarrationResult = { text: string; source: "live" | "fallback" };

/**
 * The one live-AI touch in this sim: a witty one-liner about the sort. Buckets
 * themselves are computed deterministically on the client (lib/emailsim), so
 * this never affects correctness — `callAI` guarantees a scripted fallback.
 */
export async function narrateSort(input: unknown): Promise<SortNarrationResult> {
  const parsed = RulesSchema.safeParse(input);
  const rules = parsed.success ? sanitize(parsed.data) : [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { text: emailSim.celebration.copy, source: "fallback" };

  const grouped = groupByBucket(emailSim, classifyInbox(emailSim, rules));
  const counts = Object.fromEntries(
    Object.entries(grouped).map(([k, v]) => [k, v.length]),
  ) as Record<string, number>;

  const prompt = buildSortNarrationPrompt(emailSim, rules, counts);
  const { text, source } = await callAI({ prompt, maxOutputTokens: 80 }, emailSim.celebration.copy);
  if (source === "fallback") {
    await captureServer(user.id, EVENTS.AI_FALLBACK_USED, { surface: "email_sim" });
  }
  return { text, source };
}

export type InboxCoachResult = {
  coachNote: string;
  topReasons: InboxTopReason[];
  source: "live" | "fallback";
};

/**
 * Dynamic coaching (spec §4.1): after the deterministic sort, one bounded JSON
 * call returns a coachNote naming the learner's ACTUAL rubric gaps plus a short
 * reason for each top email (AI visibly "reading" the mail). The sort + rubric
 * stay deterministic (lib/emailsim); `callJsonAI` guarantees the scripted golden
 * (today's rubric string) on any failure. Prompt is authored-content only; we
 * never log it or the response (DPDP). topReasons are filtered to real inbox ids.
 */
export async function coachInboxSort(input: unknown): Promise<InboxCoachResult> {
  const parsed = RulesSchema.safeParse(input);
  const rules = parsed.success ? sanitize(parsed.data) : [];

  const rubric = gradeRulebook(emailSim, rules);
  const golden = inboxCoachGolden(rubric);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...golden, source: "fallback" };

  const failedLabels = rubric.results.filter((r) => !r.passed).map((r) => r.label);
  const top = topEmails(emailSim, classifyInbox(emailSim, rules), 4);
  const prompt = buildInboxCoachPrompt(emailSim, failedLabels, top);

  const { data, source } = await callJsonAI({
    req: { prompt, maxOutputTokens: 300 },
    golden,
    schema: InboxCoachSchema,
  });
  if (source === "fallback") {
    await captureServer(user.id, EVENTS.AI_FALLBACK_USED, { surface: "email_sim_coach" });
  }
  return {
    coachNote: data.coachNote,
    topReasons: sanitizeTopReasons(emailSim, data.topReasons),
    source,
  };
}

export type EmailCompleteResult =
  | {
      ok: true;
      alreadyDone: boolean;
      xpAwarded: number;
      leveledUp: boolean;
      newLevel: number;
      streak: number;
      streakAdvanced: boolean;
      badge: string;
      score: number;
      total: number;
    }
  | { ok: false; error: string };

/**
 * Record the finished Inbox Tamer — the north-star FULL sim. Inserts a
 * `sim_completions` row (is_full=TRUE, with the rubric), saves the compiled
 * rulebook prompt as a `saved_artifacts` "second brain" entry, awards +120 XP,
 * and advances the tz-aware streak. Idempotent via an existence check (mirrors
 * completeTasteSim; sim_completions has no unique key). Rubric is coaching, not
 * gatekeeping — completion is always allowed.
 */
export async function completeEmailSim(input: unknown): Promise<EmailCompleteResult> {
  const parsed = RulesSchema.safeParse(input);
  const rules = parsed.success ? sanitize(parsed.data) : [];

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

  const rubric = gradeRulebook(emailSim, rules);

  // Node-ledger row (idempotent) so the Learn path shows this sim "done" and the
  // next milestone (System X-Ray) unlocks. sim_completions stays authoritative
  // for the north-star; this is just the progression/UI ledger.
  await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: emailSim.id,
      status: "done",
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" },
  );

  const { data: prior } = await supabase
    .from("sim_completions")
    .select("id")
    .eq("user_id", user.id)
    .eq("sim_id", emailSim.id)
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
      badge: emailSim.badge,
      score: rubric.score,
      total: rubric.total,
    };
  }

  // Save the compiled rulebook to the second brain (seeds Lesson 11).
  const { data: artifact } = await supabase
    .from("saved_artifacts")
    .insert({
      user_id: user.id,
      title: "My inbox sorter",
      source_sim: emailSim.id,
      body: compilePrompt(emailSim, rules),
    })
    .select("id")
    .maybeSingle();

  await supabase.from("sim_completions").insert({
    user_id: user.id,
    sim_id: emailSim.id,
    is_full: true,
    artifact_id: artifact?.id ?? null,
    rubric_json: { score: rubric.score, total: rubric.total, results: rubric.results },
  });

  const xpResult = applyXp(profile.xp, emailSim.xp);
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

  // North-star numerator (part 1): a FULL sim was completed.
  await captureServer(user.id, EVENTS.FULL_SIM_COMPLETED, {
    sim_id: emailSim.id,
    rubric_score: rubric.score,
  });
  if (xpResult.leveledUp) await captureServer(user.id, EVENTS.LEVEL_UP, { level: xpResult.level });
  if (streakResult.isNewDay && streakResult.isConsecutive) {
    await captureServer(user.id, EVENTS.STREAK_ADVANCED, { streak: streakResult.newStreak });
  }

  revalidateProgress();

  return {
    ok: true,
    alreadyDone: false,
    xpAwarded: emailSim.xp,
    leveledUp: xpResult.leveledUp,
    newLevel: xpResult.level,
    streak: streakResult.isNewDay ? streakResult.newStreak : profile.streak_count,
    streakAdvanced: streakResult.isNewDay && streakResult.isConsecutive,
    badge: emailSim.badge,
    score: rubric.score,
    total: rubric.total,
  };
}
