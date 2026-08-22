"use client";

// TEMP dev-only visual QA for the Learn home layout (stub data, no auth/DB).
import { LessonPath, L1_PREVIEW_PATH } from "@/components/brand/LessonPath";
import { TabBar } from "@/components/app/TabBar";

export default function LearnPreview() {
  return (
    <div className="lh">
      <header className="topbar">
        <div className="topbar-row">
          <span className="flame">🔥 7</span>
          <span className="prog">
            <i style={{ width: "62%" }} />
          </span>
          <span className="xp">L1 · 1,240 XP</span>
        </div>
      </header>
      <div className="greetbar">
        <div className="mascot">
          <div className="rune">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot/rune-hero-clean.png" alt="Rune" />
          </div>
          <div className="bubble">
            🔥 <b>Day 7</b>, Priya. Pick up where you left off.
          </div>
        </div>
      </div>
      <main className="lh-content">
        <div className="prow">
          <span className="plab">Your path</span>
          <span className="punit">Level 1 · HR &amp; AI</span>
        </div>
        <LessonPath data={L1_PREVIEW_PATH} />
      </main>
      <TabBar avatarKey="fox" />
    </div>
  );
}
