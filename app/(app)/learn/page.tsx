import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display";
import { levelProgress } from "@/lib/xp";
import { L1_SPINE, getLesson } from "@/content";
import { computeNodeStates, nextPlayableLesson } from "@/lib/progression";
import { reelsHasNew } from "@/lib/reels/newness";
import { LessonPath } from "@/components/brand/LessonPath";
import { buildLearnPath } from "@/components/brand/learnPath";
import { TabBar } from "@/components/app/TabBar";
import { assessStreakRisk, addDaysIso, STREAK_SAVE_WINDOW_DAYS } from "@/lib/streakinsurance";
import { civilDateInTz } from "@/lib/streak";
import { StreakInsurancePrompt } from "@/components/streak/StreakInsurancePrompt";
import { XpInfo } from "@/components/brand/XpInfo";
import { summarizeReferrerRewards } from "@/lib/referral";
import { ReferralBanner } from "@/components/referral/ReferralBanner";

/**
 * Learn home (ADR-015/017). Top bar (level/XP/streak) + Rune greeting + the
 * vertical winding path + bottom tab nav.
 *
 * Loading state: the route-level `loading.tsx` is the SINGLE "Rune is Tuning"
 * loader shown while this async page resolves its data. We deliberately do NOT
 * also wrap the body in an in-page <Suspense> — that produced a SECOND loader in
 * a differently-sized container, so the spinner appeared twice and jumped
 * position on every entry to /learn ("two loaders").
 *
 * NOTE: the path currently renders the representative L1 layout. Wiring it to
 * live `lesson_progress` (real done/current/locked nodes) lands with the L1
 * content seed, next in Slice 1.
 */
// Live, personalized dashboard (progress/XP/streak + at-risk prompt) — always
// render fresh so it reflects the latest activity, never a cached fetch.
export const dynamic = "force-dynamic";

export default async function LearnPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "name, avatar_name, avatar_key, xp, level, streak_count, last_active_date, timezone, onboarding_complete",
    )
    .eq("id", user.id)
    .single();

  // First-time users must finish onboarding before the dashboard (PRD/13).
  if (!profile?.onboarding_complete) redirect("/onboarding");

  const name = displayName(profile ?? {});
  const xp = profile?.xp ?? 0;
  const streak = profile?.streak_count ?? 0;
  const { level, progress } = levelProgress(xp);

  // Streak insurance: if the user is back after missing 1–2 days, offer to spend
  // XP to keep their streak (the mercy mechanic — lib/streakinsurance, ADR-002).
  // The weekly cap (Q7) counts saves already bought in the rolling window so
  // earned/referral XP can't fund an unlimited unearned streak.
  const siTz = profile?.timezone ?? "Asia/Kolkata";
  const siWindowStart = addDaysIso(civilDateInTz(new Date(), siTz), -(STREAK_SAVE_WINDOW_DAYS - 1));
  const { count: savesInWindow } = await supabase
    .from("streak_saves")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("saved_date", siWindowStart);
  const streakRisk = assessStreakRisk({
    lastActiveDate: profile?.last_active_date ?? null,
    now: new Date(),
    timeZone: siTz,
    currentStreak: streak,
    xp,
    savesInWindow: savesInWindow ?? 0,
  });

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

  const reelsNew = await reelsHasNew(supabase, user.id);

  // Referral notifier (Session 23): the referrer earned XP from an invitee's
  // session and is almost never in-app when it fires, so surface UNSEEN grants
  // here as a persisted, dismissible banner. RLS scopes the ledger to this user;
  // referrer_id = me isolates rewards THEY earned as the referrer.
  const { data: unseenRewards } = await supabase
    .from("referral_rewards")
    .select("xp_each")
    .eq("referrer_id", user.id)
    .eq("seen_by_referrer", false);
  const rewardSummary = summarizeReferrerRewards(unseenRewards ?? []);

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
          {/* ⭐ tier = XP gamification level; NOT the curriculum Level (avoids the
              "L3" vs "Level 1" collision — profile calls it AI Awesomeness Progression).
              Clickable + pulsing → opens the XP explainer. */}
          <XpInfo level={level} xp={xp} />
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
        {rewardSummary && (
          <ReferralBanner title={rewardSummary.title} subtitle={rewardSummary.subtitle} />
        )}

        {streakRisk.atRisk && (
          <StreakInsurancePrompt
            streak={streakRisk.streak}
            missedDays={streakRisk.missedDays}
            cost={streakRisk.cost}
            costPct={streakRisk.costPct}
            capReached={streakRisk.capReached}
          />
        )}

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

      <TabBar avatarKey={profile?.avatar_key} reelsNew={reelsNew} />
    </div>
  );
}
