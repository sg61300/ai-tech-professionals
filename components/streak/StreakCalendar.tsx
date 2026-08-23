"use client";

import { useState } from "react";
import Link from "next/link";
import {
  buildMonthGrid,
  prevMonth,
  nextMonth,
  monthOrdinal,
} from "@/lib/streakcal";
import "./streak.css";

export type StreakCalendarProps = {
  currentStreak: number;
  bestStreak: number;
  /** Civil 'YYYY-MM-DD' dates with a qualifying activity. */
  activeDates: string[];
  /** Today's civil date in the user's tz. */
  today: string;
  /** Account join civil date. */
  joinDate: string;
};

/** Streak calendar (PRD/17 · Design activation-spine §5), freeze tokens deferred post-MVP. */
export function StreakCalendar({
  currentStreak,
  bestStreak,
  activeDates,
  today,
  joinDate,
}: StreakCalendarProps) {
  const activeSet = new Set(activeDates);
  const [ty, tm] = today.split("-").map(Number);
  const [jy, jm] = joinDate.split("-").map(Number);

  const [view, setView] = useState({ year: ty, month: tm });
  const grid = buildMonthGrid({
    year: view.year,
    month: view.month,
    activeDates: activeSet,
    today,
    joinDate,
  });

  const viewOrd = monthOrdinal(view.year, view.month);
  const canPrev = viewOrd > monthOrdinal(jy, jm);
  const canNext = viewOrd < monthOrdinal(ty, tm);

  const goPrev = () => canPrev && setView(prevMonth(view.year, view.month));
  const goNext = () => canNext && setView(nextMonth(view.year, view.month));

  const dow = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="sc">
      <div className="sc-head">
        <Link href="/learn" className="sc-back" aria-label="Back to Learn">
          ←
        </Link>
        <h2>Your streak</h2>
      </div>

      <div className="streak-hero">
        <div className="flame-big" aria-hidden="true">
          🔥
        </div>
        <div>
          <div className="sh-n">
            {currentStreak} {currentStreak === 1 ? "day" : "days"}
          </div>
          <div className="sh-l">
            {currentStreak > 0 ? (
              <>
                Best yet: <b>{bestStreak}</b> · keep it alive today!
              </>
            ) : (
              <>
                Best yet: <b>{bestStreak}</b> · practise today to start a new run.
              </>
            )}
          </div>
        </div>
      </div>

      <div className="sc-meta">
        <div className="scm">
          <b>{currentStreak}</b>
          <span>Current</span>
        </div>
        <div className="scm">
          <b>{bestStreak}</b>
          <span>Best</span>
        </div>
      </div>

      <div className="cal-title">
        <b>{grid.label}</b>
        <span className="cal-nav">
          <button type="button" onClick={goPrev} disabled={!canPrev} aria-label="Previous month">
            ‹
          </button>
          <button type="button" onClick={goNext} disabled={!canNext} aria-label="Next month">
            ›
          </button>
        </span>
      </div>

      <div className="cal">
        {dow.map((d, i) => (
          <div className="dow" key={`dow-${i}`}>
            {d}
          </div>
        ))}
        {grid.weeks.flat().map((cell, i) =>
          cell.kind === "empty" ? (
            <div className="d empty" key={i} />
          ) : (
            <div
              className={`d ${cell.state === "prejoin" ? "miss" : cell.state}`}
              key={i}
              aria-label={
                cell.state === "done"
                  ? `${cell.date}: practised`
                  : cell.state === "today"
                    ? `${cell.date}: today`
                    : cell.date
              }
            >
              <span>{cell.dayNum}</span>
            </div>
          ),
        )}
      </div>

      <div className="sc-legend">
        <i>🔥 Practised</i>
        <i>
          <span className="lg" style={{ background: "var(--border)" }} />
          Missed
        </i>
        <i>
          <span className="lg td" />
          Today
        </i>
      </div>

      <p className="sc-foot">Every 🔥 is a day you showed up. Keep the chain alive.</p>
    </div>
  );
}
