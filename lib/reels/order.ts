/**
 * Deterministic, seed-stable ordering for the reels feed.
 *
 * Why this exists: the reels page is `force-dynamic` and a Server Action
 * (watch/like/save) re-renders the route. If the feed order is random per
 * render, that reorder remounts the reel-keyed <iframe>s — pausing the reel the
 * user is watching and starting another reel's audio. Seeding the shuffle by
 * (user, day) makes every render within a session produce the SAME order (no
 * remount), while still rotating daily so older reels resurface over time.
 */

/** xmur3 string hash → 32-bit unsigned seed. */
function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32 PRNG — small, fast, deterministic for a given 32-bit seed. */
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle seeded by `seed`. Pure: the same (items, seed) always
 * yields the same order. Does not mutate the input.
 */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = items.slice();
  const rand = mulberry32(hashSeed(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Stable feed seed for a user on a given day. Same string for every render in
 * the same UTC day, so the feed order holds steady across Server Action
 * re-renders, then rotates at the day boundary.
 */
export function feedSeed(userId: string, now: Date = new Date()): string {
  return `${userId}:${now.toISOString().slice(0, 10)}`;
}
