import { describe, it, expect } from "vitest";
import { assessStreakRisk, addDaysIso, STREAK_SAVE_PCT } from ".";

const TZ = "Asia/Kolkata";
// A fixed "now": 2026-08-26 ~12:00 IST.
const NOW = new Date("2026-08-26T06:30:00.000Z");

function assess(over: Partial<Parameters<typeof assessStreakRisk>[0]> = {}) {
  return assessStreakRisk({
    lastActiveDate: "2026-08-24", // missed 1 day (25th) by default
    now: NOW,
    timeZone: TZ,
    currentStreak: 5,
    xp: 300,
    ...over,
  });
}

describe("addDaysIso", () => {
  it("subtracts across a month boundary", () => {
    expect(addDaysIso("2026-09-01", -1)).toBe("2026-08-31");
  });
  it("adds across a year boundary", () => {
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("assessStreakRisk", () => {
  it("is NOT at risk when active yesterday (consecutive)", () => {
    const r = assess({ lastActiveDate: "2026-08-25" });
    expect(r.atRisk).toBe(false);
    expect(r.missedDays).toBe(0);
  });

  it("is NOT at risk when already active today", () => {
    const r = assess({ lastActiveDate: "2026-08-26" });
    expect(r.atRisk).toBe(false);
  });

  it("offers a 10% save after missing exactly 1 day", () => {
    const r = assess({ lastActiveDate: "2026-08-24", xp: 300 });
    expect(r.atRisk).toBe(true);
    expect(r.missedDays).toBe(1);
    expect(r.costPct).toBe(STREAK_SAVE_PCT[1]);
    expect(r.cost).toBe(30); // round(300 * .10)
    expect(r.streak).toBe(5);
  });

  it("offers a 20% save after missing 2 days", () => {
    const r = assess({ lastActiveDate: "2026-08-23", xp: 300 });
    expect(r.atRisk).toBe(true);
    expect(r.missedDays).toBe(2);
    expect(r.costPct).toBe(STREAK_SAVE_PCT[2]);
    expect(r.cost).toBe(60); // round(300 * .20)
  });

  it("does NOT offer a save after missing 3+ days (streak resets)", () => {
    const r = assess({ lastActiveDate: "2026-08-22" });
    expect(r.atRisk).toBe(false);
    expect(r.missedDays).toBe(0);
  });

  it("is NOT at risk with a zero streak", () => {
    expect(assess({ currentStreak: 0 }).atRisk).toBe(false);
  });

  it("is NOT at risk with no prior activity", () => {
    expect(assess({ lastActiveDate: null }).atRisk).toBe(false);
  });

  it("rounds the cost to the nearest XP", () => {
    // 305 * .10 = 30.5 → 31
    expect(assess({ lastActiveDate: "2026-08-24", xp: 305 }).cost).toBe(31);
  });

  it("computes bridgeDate as the civil day before today", () => {
    expect(assess().bridgeDate).toBe("2026-08-25");
  });

  it("is affordable by construction — cost never exceeds xp", () => {
    const r = assess({ lastActiveDate: "2026-08-23", xp: 10 });
    expect(r.cost).toBeLessThanOrEqual(10);
  });
});
