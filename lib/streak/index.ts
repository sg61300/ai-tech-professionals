/**
 * Timezone-aware streak logic — the correctness heart of the north-star metric
 * ("completed a full sim AND returned on a separate day within 7 days").
 *
 * Everything here works on the user's *civil date* in their persisted timezone,
 * derived from a UTC instant via Intl. Never do day-boundary math in UTC or the
 * server's local time: an activity at 11pm IST and one at 1am IST are the SAME
 * UTC date but DIFFERENT user days — that seam is exactly what breaks streaks.
 */

/** Civil (wall-clock) date in `timeZone` for a UTC instant, as 'YYYY-MM-DD'. */
export function civilDateInTz(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Whole-day difference between two 'YYYY-MM-DD' civil dates (b - a). */
export function dayDiff(a: string, b: string): number {
  const toMid = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toMid(b) - toMid(a)) / 86_400_000);
}

export type StreakInput = {
  /** Last date (user-tz civil, 'YYYY-MM-DD') the user was active, or null if never. */
  lastActiveDate: string | null;
  /** The moment "now", as a UTC instant. */
  now: Date;
  /** User's IANA timezone, persisted at signup (e.g. 'Asia/Kolkata'). */
  timeZone: string;
  /** Their current streak_count before this activity. */
  currentStreak: number;
};

export type StreakResult = {
  /** Today (user tz) is a different civil date than lastActiveDate. */
  isNewDay: boolean;
  /** Today is exactly the day after lastActiveDate (streak continues). */
  isConsecutive: boolean;
  /** Resulting streak_count to persist. */
  newStreak: number;
  /** Today's civil date in the user tz — persist as last_active_date + daily_activity. */
  today: string;
};

/**
 * Pure streak transition. Call on every activity write; persist `newStreak` and
 * `today` only when `isNewDay` (a same-day repeat must not bump anything).
 */
export function computeStreak(input: StreakInput): StreakResult {
  const { lastActiveDate, now, timeZone, currentStreak } = input;
  const today = civilDateInTz(now, timeZone);

  // First-ever activity.
  if (lastActiveDate === null) {
    return { isNewDay: true, isConsecutive: false, newStreak: 1, today };
  }

  // Already active today — no change.
  if (today === lastActiveDate) {
    return { isNewDay: false, isConsecutive: false, newStreak: currentStreak, today };
  }

  const diff = dayDiff(lastActiveDate, today);

  // Defensive: clock skew / bad data putting "today" before last active.
  if (diff <= 0) {
    return { isNewDay: false, isConsecutive: false, newStreak: currentStreak, today };
  }

  // Consecutive day — streak continues.
  if (diff === 1) {
    return { isNewDay: true, isConsecutive: true, newStreak: currentStreak + 1, today };
  }

  // Gap of 2+ days — streak resets, today counts as day 1.
  return { isNewDay: true, isConsecutive: false, newStreak: 1, today };
}
