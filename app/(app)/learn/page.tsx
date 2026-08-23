import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display";
import { levelProgress } from "@/lib/xp";
import { L1_SPINE, getLesson } from "@/content";
import { computeNodeStates, nextPlayableLesson } from "@/lib/progression";
import { LessonPath } from "@/components/brand/LessonPath";
import { buildLearnPath } from "@/components/brand/learnPath";
import { TabBar } from "@/components/app/TabBar";
import { RuneLoader } from "@/components/brand/RuneLoader";

/**
 * Learn home (ADR-015/017). Top bar (level/XP/streak) + Rune greeting + the
 * vertical winding path + bottom tab nav. Streams behind the "Rune is Tuning"
 * loader while the profile resolves.
 *
 * NOTE: the path currently renders the representative L1 layout. Wiring it to
 * live `lesson_progress` (real done/current/locked nodes) lands with the L1
 * content seed, next in Slice 1.
 */
export default function LearnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center">
          <RuneLoader size={200} />
        </div>
      }
    >
      <LearnHome />
    </Suspense>
  );
}

async function LearnHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, avatar_name, avatar_key, xp, level, streak_count, onboarding_complete")
    .eq("id", user.id)
    .single();

  // First-time users must finish onboarding before the dashboard (PRD/13).
  if (!profile?.onboarding_complete) redirect("/onboarding");

  const name = displayName(profile ?? {});
  const xp = profile?.xp ?? 0;
  const streak = profile?.streak_count ?? 0;
  const { level, progress } = levelProgress(xp);

  // Live progression: which lessons are done drives every node's state.
  const { data: progressRows } = await supabase
    .from("lesson_progress")
    .select("lesson_id, status")
    .eq("user_id", user.id)
    .eq("status", "done");
  const completed = new Set((progressRows ?? []).map((r) => r.lesson_id));
  const states = computeNodeStates(L1_SPINE, completed);
  const pathData = buildLearnPath(L1_SPINE, states);

  const resumeId = nextPlayableLesson(L1_SPINE, completed);
  const resumeLesson = resumeId ? getLesson(resumeId) : null;
  const allDone = resumeId === null;

  return (
    <div className="lh">
      <header className="topbar">
        <div className="topbar-row">
          <Link href="/learn/streak" className="flame" aria-label="Open streak calendar">
            🔥 {streak}
          </Link>
          <span className="prog">
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
          <span className="xp">
            L{level} · {xp.toLocaleString()} XP
          </span>
        </div>
      </header>

      <div className="greetbar">
        <div className="mascot">
          <div className="rune">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot/rune-hero-clean.png" alt="Rune" />
          </div>
          <div className="bubble">
            {streak >= 2 ? (
              <>
                <span className="gline">
                  🔥 Day {streak}, <b>{name}</b>.
                </span>
                <span className="gsub">Pick up where you left off.</span>
              </>
            ) : (
              <>
                <span className="gline">
                  Welcome, <b>{name}</b>!
                </span>
                <span className="gsub">Ready for a 5-minute win?</span>
              </>
            )}
          </div>
        </div>
      </div>

      <main className="lh-content">
        {resumeLesson ? (
          <Link href={`/learn/lesson/${resumeLesson.id}`} className="resume-card">
            <span className="resume-kick">{completed.size === 0 ? "Start here" : "Continue"}</span>
            <span className="resume-title">
              Lesson {resumeLesson.id.replace(/^l/, "")} · {resumeLesson.title}
            </span>
            <span className="resume-go">Begin →</span>
          </Link>
        ) : allDone ? (
          <div className="resume-card done">
            <span className="resume-kick">Unit 1 complete 🎉</span>
            <span className="resume-title">Your next milestone unlocks soon.</span>
          </div>
        ) : null}

        <div className="prow">
          <span className="plab">Your path</span>
          <span className="punit">Level 1 · HR &amp; AI</span>
        </div>
        <LessonPath data={pathData} />
      </main>

      <TabBar avatarKey={profile?.avatar_key} />
    </div>
  );
}
