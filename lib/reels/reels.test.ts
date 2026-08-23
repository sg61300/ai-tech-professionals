import { describe, it, expect } from "vitest";
import {
  reelXpForWatch,
  isWatched,
  REEL_XP_PER_WATCH,
  REEL_XP_MAX_WATCHES,
  REEL_WATCH_MS,
} from "./index";

describe("reel XP cap", () => {
  it("awards per-watch XP below the cap", () => {
    expect(reelXpForWatch(0)).toBe(REEL_XP_PER_WATCH);
    expect(reelXpForWatch(REEL_XP_MAX_WATCHES - 1)).toBe(REEL_XP_PER_WATCH);
  });

  it("awards nothing at or beyond the cap", () => {
    expect(reelXpForWatch(REEL_XP_MAX_WATCHES)).toBe(0);
    expect(reelXpForWatch(REEL_XP_MAX_WATCHES + 3)).toBe(0);
  });
});

describe("isWatched threshold", () => {
  it("qualifies at ≥15s regardless of duration", () => {
    expect(isWatched(REEL_WATCH_MS, 60_000)).toBe(true);
    expect(isWatched(REEL_WATCH_MS - 1, null)).toBe(false);
  });

  it("qualifies at ≥50% of a short clip before 15s", () => {
    expect(isWatched(5_000, 8_000)).toBe(true); // 62%
    expect(isWatched(3_000, 8_000)).toBe(false); // 37%, under 15s
  });

  it("never qualifies with no time and unknown duration", () => {
    expect(isWatched(0, null)).toBe(false);
  });
});
