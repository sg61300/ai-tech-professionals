"use client";

// TEMP dev-only visual QA for the Learn home layout (stub data, no auth/DB).
// Now renders the REAL 18-node L1_SPINE via buildLearnPath so path DENSITY
// matches production (S15: full Level 1). A slider fakes how many spine nodes
// are "done" to inspect the current/done/locked spread.
import { useState } from "react";
import { L1_SPINE } from "@/content";
import { computeNodeStates } from "@/lib/progression";
import { LessonPath } from "@/components/brand/LessonPath";
import { buildLearnPath } from "@/components/brand/learnPath";
import { TabBar } from "@/components/app/TabBar";

export default function LearnPreview() {
  // Mark the first N non-lock spine nodes as completed.
  const [doneCount, setDoneCount] = useState(6);
  const completable = L1_SPINE.filter((n) => n.kind !== "lock");
  const completed = new Set(completable.slice(0, doneCount).map((n) => n.id));
  const states = computeNodeStates(L1_SPINE, completed);
  const pathData = buildLearnPath(L1_SPINE, states);

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            padding: "0 4px 8px",
            color: "#888",
          }}
        >
          <span>done: {doneCount}</span>
          <input
            type="range"
            min={0}
            max={completable.length}
            value={doneCount}
            onChange={(e) => setDoneCount(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span>{L1_SPINE.length} nodes</span>
        </div>
        <LessonPath data={pathData} />
      </main>
      <TabBar avatarKey="fox" />
    </div>
  );
}
