import { describe, it, expect } from "vitest";
import { cumXpForLevel, levelFromXp, levelProgress, applyXp } from "./index";

describe("cumXpForLevel", () => {
  it("follows the 50*n*(n-1) curve", () => {
    expect(cumXpForLevel(1)).toBe(0);
    expect(cumXpForLevel(2)).toBe(100);
    expect(cumXpForLevel(3)).toBe(300);
    expect(cumXpForLevel(4)).toBe(600);
  });
});

describe("levelFromXp", () => {
  it("maps XP to the right level at and around boundaries", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(299)).toBe(2);
    expect(levelFromXp(300)).toBe(3);
  });
  it("never goes below level 1 for junk input", () => {
    expect(levelFromXp(-50)).toBe(1);
  });
});

describe("levelProgress", () => {
  it("reports fill within a level", () => {
    const p = levelProgress(150); // level 2 (100..300), 50 into a 200-wide level
    expect(p).toMatchObject({ level: 2, xpIntoLevel: 50, xpForThisLevel: 200 });
    expect(p.progress).toBeCloseTo(0.25);
  });
  it("is 0 at the start of a level", () => {
    expect(levelProgress(100).progress).toBe(0);
  });
});

describe("applyXp", () => {
  it("adds XP without crossing a level", () => {
    expect(applyXp(10, 20)).toMatchObject({ xp: 30, level: 1, fromLevel: 1, leveledUp: false });
  });
  it("detects a level-up", () => {
    expect(applyXp(90, 20)).toMatchObject({ xp: 110, level: 2, fromLevel: 1, leveledUp: true });
  });
  it("floors XP at 0 for negative deltas", () => {
    expect(applyXp(10, -50)).toMatchObject({ xp: 0, level: 1 });
  });
});
