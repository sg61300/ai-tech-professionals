"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics/server";
import { EVENTS } from "@/lib/analytics/events";
import { applyXp } from "@/lib/xp";
import { computeStreak } from "@/lib/streak";
import { reelXpForWatch, REEL_XP_MAX_WATCHES } from "@/lib/reels";
import { revalidateProgress } from "@/lib/revalidate";

const ReelIdSchema = z.coerce.number().int().positive();
const ToggleTypeSchema = z.enum(["like", "save", "share", "report"]);

const EVENT_FOR = {
  like: EVENTS.REEL_LIKED,
  save: EVENTS.REEL_SAVED,
  share: EVENTS.REEL_SHARED,
  report: EVENTS.REEL_REPORTED,
} as const;

export type ToggleResult =
  | { ok: true; active: boolean }
  | { ok: false; error: string };

/**
 * Like / Save are toggles (tap again to undo); Share / Report are one-way flags
 * to the curation queue. All idempotent via the (user, reel, type) unique key.
 * A Save also mirrors the reel into the profile "second brain" (saved_artifacts).
 */
const ReasonSchema = z.string().trim().min(1).max(60).optional();

export async function toggleReelInteraction(
  reelIdRaw: unknown,
  typeRaw: unknown,
  reasonRaw?: unknown,
): Promise<ToggleResult> {
  const reelId = ReelIdSchema.safeParse(reelIdRaw);
  const type = ToggleTypeSchema.safeParse(typeRaw);
  if (!reelId.success || !type.success) return { ok: false, error: "Bad input" };
  const reason = ReasonSchema.safeParse(reasonRaw);
  const reasonValue = reason.success ? reason.data : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const kind = type.data;
  const oneWay = kind === "share" || kind === "report";

  // For a Save we mirror the reel into the second brain, so fetch it once and
  // use the same URL for both insert and the toggle-off delete.
  let reelBody: string | null = null;
  let reelTitle = "Saved reel";
  if (kind === "save") {
    const { data: reel } = await supabase
      .from("reels")
      .select("title, youtube_id")
      .eq("id", reelId.data)
      .maybeSingle();
    reelBody = reelUrl(reelId.data, reel?.youtube_id);
    reelTitle = reel?.title ?? "Saved reel";
  }

  // Toggle off if it already exists (like/save only).
  if (!oneWay) {
    const { data: existing } = await supabase
      .from("reel_interactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("reel_id", reelId.data)
      .eq("type", kind)
      .maybeSingle();

    if (existing) {
      await supabase.from("reel_interactions").delete().eq("id", existing.id);
      if (kind === "save" && reelBody) {
        await supabase
          .from("saved_artifacts")
          .delete()
          .eq("user_id", user.id)
          .eq("source_sim", "reel")
          .eq("body", reelBody);
      }
      revalidatePath("/reels");
      revalidatePath("/profile"); // save/unsave mirrors the second brain
      return { ok: true, active: false };
    }
  }

  await supabase
    .from("reel_interactions")
    .upsert(
      {
        user_id: user.id,
        reel_id: reelId.data,
        type: kind,
        ...(kind === "report" && reasonValue ? { reason: reasonValue } : {}),
      },
      { onConflict: "user_id,reel_id,type", ignoreDuplicates: true },
    );

  if (kind === "save" && reelBody) {
    await supabase.from("saved_artifacts").insert({
      user_id: user.id,
      title: reelTitle,
      source_sim: "reel",
      body: reelBody,
    });
  }

  await captureServer(user.id, EVENT_FOR[kind], {
    reel_id: reelId.data,
    ...(kind === "report" && reasonValue ? { reason: reasonValue } : {}),
  });
  revalidatePath("/reels");
  revalidatePath("/profile"); // a Save mirrors the reel into the second brain
  return { ok: true, active: !oneWay };
}

export type WatchResult =
  | { ok: true; xpAwarded: number; alreadyWatched: boolean; capped: boolean }
  | { ok: false; error: string };

/**
 * Record a "watched" reel (client enforces the ≥15s/≥50% threshold). Idempotent
 * per (user, reel) via a 'watch' interaction row. Awards small capped XP and
 * marks the day active for the streak — reels keep the chain alive but can't
 * farm XP past the daily cap (PRD/14).
 */
export async function recordReelWatch(reelIdRaw: unknown): Promise<WatchResult> {
  const reelId = ReelIdSchema.safeParse(reelIdRaw);
  if (!reelId.success) return { ok: false, error: "Bad input" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Already counted this reel — no double award.
  const { data: prior } = await supabase
    .from("reel_interactions")
    .select("id")
    .eq("user_id", user.id)
    .eq("reel_id", reelId.data)
    .eq("type", "watch")
    .maybeSingle();
  if (prior) return { ok: true, xpAwarded: 0, alreadyWatched: true, capped: false };

  await supabase.from("reel_interactions").insert({
    user_id: user.id,
    reel_id: reelId.data,
    type: "watch",
  });

  await captureServer(user.id, EVENTS.REEL_VIEWED, { reel_id: reelId.data });

  // How many XP-earning watches already today (user tz) → cap check.
  const { data: profile } = await supabase
    .from("profiles")
    .select("xp, streak_count, longest_streak, last_active_date, timezone")
    .eq("id", user.id)
    .single();
  if (!profile) return { ok: false, error: "No profile" };

  // Rolling 24h window is a simple, bounded proxy for "today" on UTC-stamped rows.
  const { count: watchesToday } = await supabase
    .from("reel_interactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("type", "watch")
    .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());

  // Prior watches today (exclude the one just inserted).
  const priorWatches = Math.max(0, (watchesToday ?? 1) - 1);
  const xp = reelXpForWatch(priorWatches);
  const capped = priorWatches >= REEL_XP_MAX_WATCHES;

  const xpResult = applyXp(profile.xp, xp);
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

  if (streakResult.isNewDay && streakResult.isConsecutive) {
    await captureServer(user.id, EVENTS.STREAK_ADVANCED, { streak: streakResult.newStreak });
  }

  // A watch moves XP + streak → refresh the dashboard, calendar, and profile.
  revalidateProgress();

  return { ok: true, xpAwarded: xp, alreadyWatched: false, capped };
}

function reelUrl(_reelId: number, youtubeId?: string | null): string {
  return youtubeId ? `https://www.youtube.com/shorts/${youtubeId}` : `reel:${_reelId}`;
}
