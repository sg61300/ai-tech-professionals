"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics/server";
import { EVENTS } from "@/lib/analytics/events";
import { applyXp } from "@/lib/xp";
import { civilDateInTz } from "@/lib/streak";
import { assessStreakRisk, addDaysIso, STREAK_SAVE_WINDOW_DAYS } from "@/lib/streakinsurance";

export type SaveStreakResult =
  | { ok: true; xpSpent: number; newXp: number; newLevel: number; streak: number }
  | {
      ok: false;
      error:
        | "not_signed_in"
        | "no_profile"
        | "not_at_risk"
        | "already_saved"
        | "weekly_cap_reached"
        | "save_failed";
    };

/**
 * Spend XP to keep a streak alive after a 1–2 day gap (the mercy mechanic — see
 * lib/streakinsurance + ADR-002). Everything is re-derived server-side from the
 * profile — the client is never trusted for the cost or eligibility.
 *
 * Idempotency + concurrency: the `streak_saves` insert (unique per user+day) is
 * the lock — we insert FIRST, and only deduct XP / bridge the streak if that
 * insert wins, so a double-tap or race can never charge twice. On save we bridge
 * `last_active_date` to *yesterday* so the next activity continues the streak;
 * we never fabricate `daily_activity` rows, so the calendar stays honest.
 */
export async function saveStreak(): Promise<SaveStreakResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_signed_in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("xp, streak_count, last_active_date, timezone")
    .eq("id", user.id)
    .single();
  if (!profile) return { ok: false, error: "no_profile" };

  // Weekly-cap guardrail (Q7): count saves already bought in the rolling window,
  // INDEPENDENT of XP balance, so referral/earned XP can't fund an unlimited
  // unearned streak. Re-derived server-side — the client is never trusted.
  const tz = profile.timezone ?? "Asia/Kolkata";
  const today = civilDateInTz(new Date(), tz);
  const windowStart = addDaysIso(today, -(STREAK_SAVE_WINDOW_DAYS - 1));
  const { count: savesInWindow } = await supabase
    .from("streak_saves")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("saved_date", windowStart);

  const risk = assessStreakRisk({
    lastActiveDate: profile.last_active_date,
    now: new Date(),
    timeZone: tz,
    currentStreak: profile.streak_count,
    xp: profile.xp,
    savesInWindow: savesInWindow ?? 0,
  });
  if (!risk.atRisk) return { ok: false, error: "not_at_risk" };
  if (risk.capReached) return { ok: false, error: "weekly_cap_reached" };

  // Insert-first idempotency lock: one save per return-day. A unique-violation
  // means this return-day was already saved (double-tap / race) — bail without
  // charging again.
  const { error: insertErr } = await supabase.from("streak_saves").insert({
    user_id: user.id,
    saved_date: risk.today,
    gap_days: risk.missedDays,
    streak_kept: risk.streak,
    xp_spent: risk.cost,
  });
  // 23505 = unique violation → this return-day was already saved (double-tap /
  // race). Any other error is a real failure (e.g. table missing) — surface it.
  if (insertErr) {
    return { ok: false, error: insertErr.code === "23505" ? "already_saved" : "save_failed" };
  }

  // Charge the XP and bridge the streak (last_active_date → yesterday).
  const xpResult = applyXp(profile.xp, -risk.cost);
  await supabase
    .from("profiles")
    .update({
      xp: xpResult.xp,
      level: xpResult.level,
      last_active_date: risk.bridgeDate,
    })
    .eq("id", user.id);

  await captureServer(user.id, EVENTS.STREAK_SAVED, {
    gap_days: risk.missedDays,
    xp_spent: risk.cost,
    streak: risk.streak,
  });

  // Revalidate every surface that shows streak/XP so a save reflects immediately:
  // the dashboard, the streak calendar (the saved day → 💎 crystal), and profile.
  revalidatePath("/learn");
  revalidatePath("/learn/streak");
  revalidatePath("/profile");

  return {
    ok: true,
    xpSpent: risk.cost,
    newXp: xpResult.xp,
    newLevel: xpResult.level,
    streak: risk.streak,
  };
}
