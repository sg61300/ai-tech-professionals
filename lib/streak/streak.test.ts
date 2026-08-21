import { describe, it, expect } from "vitest";
import { civilDateInTz, dayDiff, computeStreak } from "./index";

const IST = "Asia/Kolkata"; // UTC+5:30, no DST
const NY = "America/New_York"; // has DST

describe("civilDateInTz", () => {
  it("maps a UTC instant to the correct IST civil date across the day boundary", () => {
    // 23:00 IST Aug 21 == 17:30 UTC Aug 21
    expect(civilDateInTz(new Date("2026-08-21T17:30:00Z"), IST)).toBe("2026-08-21");
    // 01:00 IST Aug 22 == 19:30 UTC Aug 21  (same UTC date, DIFFERENT IST day)
    expect(civilDateInTz(new Date("2026-08-21T19:30:00Z"), IST)).toBe("2026-08-22");
  });

  it("resolves DST correctly for America/New_York", () => {
    // 2026 US DST begins Sun Mar 8. 06:30 UTC == 01:30 local (still EST that instant)
    expect(civilDateInTz(new Date("2026-03-08T06:30:00Z"), NY)).toBe("2026-03-08");
    // After spring-forward, 12:00 UTC == 08:00 EDT
    expect(civilDateInTz(new Date("2026-03-08T12:00:00Z"), NY)).toBe("2026-03-08");
  });
});

describe("dayDiff", () => {
  it("counts whole days between civil dates, including month/year rollover", () => {
    expect(dayDiff("2026-08-21", "2026-08-22")).toBe(1);
    expect(dayDiff("2026-08-21", "2026-08-21")).toBe(0);
    expect(dayDiff("2026-08-31", "2026-09-01")).toBe(1);
    expect(dayDiff("2026-12-31", "2027-01-01")).toBe(1);
    expect(dayDiff("2026-08-21", "2026-08-25")).toBe(4);
  });
});

describe("computeStreak", () => {
  it("first-ever activity starts the streak at 1", () => {
    const r = computeStreak({
      lastActiveDate: null,
      now: new Date("2026-08-21T10:00:00Z"),
      timeZone: IST,
      currentStreak: 0,
    });
    expect(r).toMatchObject({ isNewDay: true, isConsecutive: false, newStreak: 1, today: "2026-08-21" });
  });

  it("IST 11pm -> 1am counts as a NEW consecutive day (the seam UTC math would miss)", () => {
    // Last active late night IST Aug 21; returning just after midnight IST -> Aug 22.
    const r = computeStreak({
      lastActiveDate: "2026-08-21",
      now: new Date("2026-08-21T19:30:00Z"), // 01:00 IST Aug 22
      timeZone: IST,
      currentStreak: 3,
    });
    expect(r).toMatchObject({ isNewDay: true, isConsecutive: true, newStreak: 4, today: "2026-08-22" });
  });

  it("a second activity the same user-day does not bump the streak", () => {
    const r = computeStreak({
      lastActiveDate: "2026-08-22",
      now: new Date("2026-08-22T06:00:00Z"), // 11:30 IST Aug 22
      timeZone: IST,
      currentStreak: 4,
    });
    expect(r).toMatchObject({ isNewDay: false, isConsecutive: false, newStreak: 4, today: "2026-08-22" });
  });

  it("a gap of 2+ days resets the streak to 1", () => {
    const r = computeStreak({
      lastActiveDate: "2026-08-21",
      now: new Date("2026-08-24T10:00:00Z"),
      timeZone: IST,
      currentStreak: 9,
    });
    expect(r).toMatchObject({ isNewDay: true, isConsecutive: false, newStreak: 1, today: "2026-08-24" });
  });

  it("is defensive against a 'today' that precedes last_active (clock skew)", () => {
    const r = computeStreak({
      lastActiveDate: "2026-08-25",
      now: new Date("2026-08-21T10:00:00Z"),
      timeZone: IST,
      currentStreak: 5,
    });
    expect(r).toMatchObject({ isNewDay: false, newStreak: 5 });
  });
});
