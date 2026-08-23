/**
 * Pure month-grid model for the streak calendar (PRD/17 · Design activation-spine §5).
 *
 * All day math is done on civil 'YYYY-MM-DD' strings already normalised to the
 * user's timezone upstream (see lib/streak). No Date-object day arithmetic here,
 * so DST / tz seams can't corrupt which cell a day lands in.
 */

export type DayState = "done" | "miss" | "today" | "future" | "prejoin";

export type DayCell =
  | { kind: "empty" }
  | { kind: "day"; date: string; dayNum: number; state: DayState; active: boolean };

export type MonthGrid = {
  /** 1-12. */ month: number;
  year: number;
  /** e.g. "August 2026". */ label: string;
  /** Monday-first weeks, each exactly 7 cells (trailing padded with empty). */
  weeks: DayCell[][];
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** 'YYYY-MM-DD' for a civil y/m(1-12)/d. */
export function isoOf(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Days in a civil month (month is 1-12). */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of next month == last day of this month. Uses UTC to avoid tz drift.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Weekday of the 1st, Monday-first (Mon=0 … Sun=6). */
export function firstWeekdayMondayFirst(year: number, month: number): number {
  const dow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // Sun=0
  return (dow + 6) % 7;
}

export type MonthGridInput = {
  year: number;
  /** 1-12. */ month: number;
  /** Civil dates ('YYYY-MM-DD') with a qualifying activity. */
  activeDates: ReadonlySet<string>;
  /** Today's civil date ('YYYY-MM-DD') in the user's tz. */
  today: string;
  /** Account join civil date ('YYYY-MM-DD'); days before it aren't "missed". */
  joinDate: string;
};

export function buildMonthGrid(input: MonthGridInput): MonthGrid {
  const { year, month, activeDates, today, joinDate } = input;
  const total = daysInMonth(year, month);
  const lead = firstWeekdayMondayFirst(year, month);

  const cells: DayCell[] = [];
  for (let i = 0; i < lead; i++) cells.push({ kind: "empty" });

  for (let day = 1; day <= total; day++) {
    const date = isoOf(year, month, day);
    const active = activeDates.has(date);
    let state: DayState;
    if (date > today) state = "future";
    else if (date === today) state = "today";
    else if (active) state = "done";
    else if (date < joinDate) state = "prejoin";
    else state = "miss";
    cells.push({ kind: "day", date, dayNum: day, state, active });
  }

  while (cells.length % 7 !== 0) cells.push({ kind: "empty" });

  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return { month, year, label: `${MONTHS[month - 1]} ${year}`, weeks };
}

/** Previous month as {year, month}, wrapping across January. */
export function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/** Next month as {year, month}, wrapping across December. */
export function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/** Compare (y,m) as an ordinal so callers can clamp paging to [join, today]. */
export function monthOrdinal(year: number, month: number): number {
  return year * 12 + (month - 1);
}
