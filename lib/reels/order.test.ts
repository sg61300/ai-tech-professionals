import { describe, it, expect } from "vitest";
import { seededShuffle, feedSeed } from "./order";

const ids = Array.from({ length: 50 }, (_, i) => i);

describe("seededShuffle", () => {
  it("is deterministic — same seed yields the same order (the bug fix)", () => {
    // This is the whole point: a Server Action re-render must reproduce the
    // exact same feed order so the keyed <iframe>s never remount.
    const a = seededShuffle(ids, "user-1:2026-08-29");
    const b = seededShuffle(ids, "user-1:2026-08-29");
    expect(a).toEqual(b);
  });

  it("produces a valid permutation (same elements, none lost or duplicated)", () => {
    const out = seededShuffle(ids, "seed");
    expect(out).toHaveLength(ids.length);
    expect([...out].sort((x, y) => x - y)).toEqual([...ids].sort((x, y) => x - y));
  });

  it("does not mutate the input array", () => {
    const input = [...ids];
    const copy = [...input];
    seededShuffle(input, "seed");
    expect(input).toEqual(copy);
  });

  it("actually shuffles (different from input for a non-trivial list)", () => {
    const out = seededShuffle(ids, "seed-x");
    expect(out).not.toEqual(ids);
  });

  it("different seeds generally give different orders", () => {
    const a = seededShuffle(ids, "user-1:2026-08-29");
    const b = seededShuffle(ids, "user-1:2026-08-30");
    expect(a).not.toEqual(b);
  });

  it("handles empty and single-element arrays", () => {
    expect(seededShuffle([], "seed")).toEqual([]);
    expect(seededShuffle([42], "seed")).toEqual([42]);
  });
});

describe("feedSeed", () => {
  it("is stable across the same UTC day (no reshuffle mid-session)", () => {
    const morning = new Date("2026-08-29T06:00:00Z");
    const night = new Date("2026-08-29T23:30:00Z");
    expect(feedSeed("user-1", morning)).toBe(feedSeed("user-1", night));
  });

  it("rotates across days and differs per user", () => {
    const d1 = new Date("2026-08-29T10:00:00Z");
    const d2 = new Date("2026-08-30T10:00:00Z");
    expect(feedSeed("user-1", d1)).not.toBe(feedSeed("user-1", d2));
    expect(feedSeed("user-1", d1)).not.toBe(feedSeed("user-2", d1));
  });

  it("end-to-end: two renders same day → identical feed order", () => {
    const render1 = seededShuffle(ids, feedSeed("u", new Date("2026-08-29T06:00:00Z")));
    const render2 = seededShuffle(ids, feedSeed("u", new Date("2026-08-29T21:00:00Z")));
    expect(render1).toEqual(render2);
  });
});
