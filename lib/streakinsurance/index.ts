/**
 * Streak insurance ("save my streak") — a *mercy* mechanic, not a punishment
 * (ADR-002). When a user returns after missing a day or two, they may spend a
 * PERCENTAGE of their XP to keep their streak alive instead of it resetting.
 *
 * Model (settled in PROJECT-STATE "Marked / open" + Session 17):
 *   - miss 1 day  → spend 10% of XP to keep the streak
 *   - miss 2 days → spend 20% of XP to keep the streak
 *   - miss 3+ days → not offered; the streak resets normally
 * Percentage cost scales with what the user has, so it is ALWAYS affordable
 * (no "insufficient XP → sad reset" path) — the kindest reading of the spec.
 *
 * We do NOT ship banked "freeze tokens" (dropped in S13: no data model → would
 * fake data). This spends the real XP currency the user already has.
 *
 * On save we bridge `last_active_date` to *yesterday* so the next activity
 * counts as consecutive and the streak is preserved — we never fabricate a
 * `daily_activity` row for the missed days, so the calendar stays honest.
 */

import { civilDateInTz, dayDiff } from "@/lib/streak";

/** XP fraction spent to save the streak, keyed by number of missed days. */
export const STREAK_SAVE_PCT: Record<number, number> = { 1: 0.1, 2: 0.2 };
/** Beyond this many missed days the streak simply resets (no offer). */
export const MAX_SAVEABLE_MISS = 2;

/**
 * Weekly cap on streak-saves (Q7 guardrail, Session 22). A user may buy at most
 * this many saves within STREAK_SAVE_WINDOW_DAYS, INDEPENDENT of their XP
 * balance. This is the guard that stops earned-elsewhere XP (e.g. referral XP)
 * from funding an unlimited, unearned streak that would make retention lie.
 */
export const STREAK_SAVE_WEEKLY_CAP = 2;
/** Rolling window (civil days) the weekly cap counts saves over. */
export const STREAK_SAVE_WINDOW_DAYS = 7;

/** Whether the user has used all their streak-saves in the current window. */
export function streakSaveCapReached(
  savesInWindow: number,
  cap: number = STREAK_SAVE_WEEKLY_CAP,
): boolean {
  return savesInWindow >= cap;
}

/** Civil date `delta` days from an ISO 'YYYY-MM-DD' (UTC-midnight math). */
export function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + delta * 86_400_000;
  const dt = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

export type StreakRiskInput = {
  /** Last civil date (user tz, 'YYYY-MM-DD') the user was active, or null. */
  lastActiveDate: string | null;
  /** The moment "now", as a UTC instant. */
  now: Date;
  /** User's IANA timezone. */
  timeZone: string;
  /** Their current streak_count. */
  currentStreak: number;
  /** Their current XP (the currency spent to save the streak). */
  xp: number;
  /** Saves already purchased in the current window (weekly cap, Q7). Default 0. */
  savesInWindow?: number;
};

export type StreakRisk = {
  /** The streak is in the savable window (missed 1–2 days) and still standing. */
  atRisk: boolean;
  /** Days missed since last active (0 when not at risk). */
  missedDays: number;
  /** The streak that would be preserved. */
  streak: number;
  /** XP to spend to save it. */
  cost: number;
  /** Fraction of XP the cost represents (0.1 / 0.2; 0 when n/a). */
  costPct: number;
  /** Civil today (user tz). */
  today: string;
  /** Civil (today − 1) — the last_active_date to persist on a save (bridge). */
  bridgeDate: string;
  /** The weekly save cap (Q7) is used up — no more saves allowed this window. */
  capReached: boolean;
  /** atRisk AND under the cap — the save may actually be offered/purchased. */
  canSave: boolean;
};

/**
 * Pure risk assessment. Determines whether to offer streak insurance and what
 * it costs. Never mutates anything — the Server Action applies the result.
 */
export function assessStreakRisk(input: StreakRiskInput): StreakRisk {
  const { lastActiveDate, now, timeZone, currentStreak, xp, savesInWindow = 0 } = input;
  const today = civilDateInTz(now, timeZone);
  const capReached = streakSaveCapReached(savesInWindow);
  const none: StreakRisk = {
    atRisk: false,
    missedDays: 0,
    streak: currentStreak,
    cost: 0,
    costPct: 0,
    today,
    bridgeDate: addDaysIso(today, -1),
    capReached,
    canSave: false,
  };

  // Nothing to save if there's no streak or no prior activity.
  if (!lastActiveDate || currentStreak <= 0) return none;

  const missedDays = dayDiff(lastActiveDate, today) - 1;
  // 0 = consecutive/same-day (safe); 1–2 = savable; 3+ = too far gone.
  if (missedDays < 1 || missedDays > MAX_SAVEABLE_MISS) return none;

  const costPct = STREAK_SAVE_PCT[missedDays];
  const cost = Math.round(Math.max(0, xp) * costPct);
  return {
    atRisk: true,
    missedDays,
    streak: currentStreak,
    cost,
    costPct,
    today,
    bridgeDate: addDaysIso(today, -1),
    capReached,
    // In the savable window, but only actually purchasable while under the cap.
    canSave: !capReached,
  };
}
