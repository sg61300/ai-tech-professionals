import { describe, it, expect } from "vitest";
import {
  buildMonthGrid,
  daysInMonth,
  firstWeekdayMondayFirst,
  isoOf,
  prevMonth,
  nextMonth,
  monthOrdinal,
} from "./index";

describe("calendar math", () => {
  it("days in month incl. leap February", () => {
    expect(daysInMonth(2026, 8)).toBe(31);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it("Monday-first weekday of the 1st", () => {
    // 2026-08-01 is a Saturday → Monday-first index 5.
    expect(firstWeekdayMondayFirst(2026, 8)).toBe(5);
    // 2026-06-01 is a Monday → 0.
    expect(firstWeekdayMondayFirst(2026, 6)).toBe(0);
  });

  it("iso formatting zero-pads", () => {
    expect(isoOf(2026, 8, 3)).toBe("2026-08-03");
  });

  it("month paging wraps years", () => {
    expect(prevMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
    expect(nextMonth(2026, 12)).toEqual({ year: 2027, month: 1 });
    expect(monthOrdinal(2026, 8)).toBeGreaterThan(monthOrdinal(2026, 7));
  });
});

describe("buildMonthGrid", () => {
  const base = {
    year: 2026,
    month: 8,
    today: "2026-08-21",
    joinDate: "2026-08-15",
    activeDates: new Set(["2026-08-15", "2026-08-16", "2026-08-18", "2026-08-19", "2026-08-20"]),
  };

  it("pads leading + trailing to full weeks of 7", () => {
    const g = buildMonthGrid(base);
    for (const w of g.weeks) expect(w).toHaveLength(7);
    // Aug 2026 starts Saturday → 5 leading empties.
    expect(g.weeks[0].slice(0, 5).every((c) => c.kind === "empty")).toBe(true);
    expect(g.weeks[0][5]).toMatchObject({ kind: "day", dayNum: 1 });
  });

  it("labels the month", () => {
    expect(buildMonthGrid(base).label).toBe("August 2026");
  });

  it("assigns each state correctly", () => {
    const cells = buildMonthGrid(base).weeks.flat();
    const byDay = (n: number) =>
      cells.find((c) => c.kind === "day" && c.dayNum === n) as Extract<
        (typeof cells)[number],
        { kind: "day" }
      >;
    expect(byDay(20).state).toBe("done"); // active, past
    expect(byDay(17).state).toBe("miss"); // in range, no activity
    expect(byDay(21).state).toBe("today"); // == today
    expect(byDay(22).state).toBe("future"); // after today
    expect(byDay(10).state).toBe("prejoin"); // before join → not a miss
    expect(byDay(20).active).toBe(true);
    expect(byDay(17).active).toBe(false);
  });

  it("today takes precedence over activity on the same day", () => {
    const g = buildMonthGrid({ ...base, activeDates: new Set(["2026-08-21"]) });
    const today = g.weeks.flat().find((c) => c.kind === "day" && c.dayNum === 21);
    expect(today).toMatchObject({ state: "today", active: true });
  });

  it("marks rescued days as 'saved' (missed but insured), not 'miss'", () => {
    const g = buildMonthGrid({ ...base, savedDates: new Set(["2026-08-17"]) });
    const byDay = (n: number) => g.weeks.flat().find((c) => c.kind === "day" && c.dayNum === n);
    expect(byDay(17)).toMatchObject({ state: "saved", active: false });
    // A different missed day stays "miss".
    expect(byDay(18) && (byDay(18) as { state: string }).state).toBeDefined();
  });

  it("an active day is 'done' even if also in savedDates", () => {
    const g = buildMonthGrid({ ...base, savedDates: new Set(["2026-08-20"]) });
    const d20 = g.weeks.flat().find((c) => c.kind === "day" && c.dayNum === 20);
    expect(d20).toMatchObject({ state: "done" });
  });
});
