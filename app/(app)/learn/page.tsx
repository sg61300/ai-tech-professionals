import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display";
import { levelProgress } from "@/lib/xp";
import { LessonPath, L1_PREVIEW_PATH } from "@/components/brand/LessonPath";
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

  return (
    <div className="lh">
      <header className="topbar">
        <div className="topbar-row">
          <span className="flame">🔥 {streak}</span>
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
                🔥 <b>Day {streak}</b>, {name}. Pick up where you left off.
              </>
            ) : (
              <>
                Welcome back, <b>{name}</b>! Ready for a 5-minute win?
              </>
            )}
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

      <TabBar avatarKey={profile?.avatar_key} />
    </div>
  );
}
