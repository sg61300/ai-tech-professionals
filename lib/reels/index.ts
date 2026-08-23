/**
 * Reel XP + "watched" rules (PRD/14). All config-driven so bingeing can't farm
 * points: a small per-watch award, capped per day. Reel activity still counts a
 * day as active for the streak, but XP stops at the cap.
 */

export const REEL_XP_PER_WATCH = 2;
export const REEL_XP_DAILY_CAP = 10;
/** Max reels that can earn XP in a day (cap / per-watch). */
export const REEL_XP_MAX_WATCHES = Math.floor(REEL_XP_DAILY_CAP / REEL_XP_PER_WATCH);

/** A reel counts as "watched" at ≥15s OR ≥50% viewed (whichever first). */
export const REEL_WATCH_MS = 15_000;
export const REEL_WATCH_FRACTION = 0.5;

/**
 * XP to award for one newly-watched reel, given how many XP-earning watches the
 * user already has today. Returns 0 once the daily cap is reached.
 */
export function reelXpForWatch(xpEarningWatchesToday: number): number {
  if (xpEarningWatchesToday >= REEL_XP_MAX_WATCHES) return 0;
  return REEL_XP_PER_WATCH;
}

/** Whether elapsed watch time / progress qualifies as "watched". */
export function isWatched(elapsedMs: number, durationMs: number | null): boolean {
  if (elapsedMs >= REEL_WATCH_MS) return true;
  if (durationMs && durationMs > 0) return elapsedMs / durationMs >= REEL_WATCH_FRACTION;
  return false;
}
