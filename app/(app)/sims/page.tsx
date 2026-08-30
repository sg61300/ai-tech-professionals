import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { L1_SPINE } from "@/content";
import { isUnlocked } from "@/lib/progression";
import { priceFor, blurbFor } from "@/lib/simunlock";
import { TabBar } from "@/components/app/TabBar";
import { SimCard } from "@/components/sims/SimCard";

/**
 * Simulations-by-Level (Design/xp-sim-unlock-spec.md §8). Lists the L1 sims as
 * XP-unlock cards — path-open sims are free to enter, locked ones can be bought
 * ahead of the path with XP. Levels 2 & 3 are locked "coming soon" outlines
 * (their content doesn't exist yet), mirroring the learn-home locked pattern.
 *
 * Live balance + unlock state must always be fresh (an unlock deducts XP and
 * flips a card), so never serve a cached fetch.
 */
export const dynamic = "force-dynamic";

export default async function SimsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_key, xp, onboarding_complete")
    .eq("id", user.id)
    .single();

  // First-time users must finish onboarding before the app (matches /learn).
  if (!profile?.onboarding_complete) redirect("/onboarding");

  const xp = profile?.xp ?? 0;

  // Which lessons are done drives path-unlock; sim_unlocks are XP purchases.
  const { data: progressRows } = await supabase
    .from("lesson_progress")
    .select("lesson_id, status")
    .eq("user_id", user.id)
    .eq("status", "done");
  const completed = new Set((progressRows ?? []).map((r) => r.lesson_id));

  const { data: unlockRows } = await supabase
    .from("sim_unlocks")
    .select("sim_id")
    .eq("user_id", user.id);
  const unlockedSet = new Set((unlockRows ?? []).map((r) => r.sim_id));

  // Completion status comes from sim_completions — the one table ALL sims write
  // (the taste sim writes only here; full sims write here + a lesson_progress
  // ledger row). Reading lesson_progress alone missed the taste sim.
  const { data: simDoneRows } = await supabase
    .from("sim_completions")
    .select("sim_id")
    .eq("user_id", user.id);
  const completedSims = new Set((simDoneRows ?? []).map((r) => r.sim_id));

  const sims = L1_SPINE.filter((n) => n.kind === "taste" || n.kind === "sim");

  return (
    <div className="lh">
      <header className="topbar">
        <div className="topbar-row sims-top">
          <div className="sims-headtext">
            <h1 className="sims-title">Simulations</h1>
            <span className="sims-sub">Practice for real. Spend XP to jump ahead.</span>
          </div>
          <span className="sims-xp" aria-label={`${xp} XP available`}>
            ⚡ {xp} XP
          </span>
        </div>
      </header>

      <main className="lh-content sims-main">
        <section className="sims-lvl">
          <div className="prow">
            <span className="plab">Level 1</span>
            <span className="punit">HR &amp; AI</span>
          </div>
          <div className="sims-grid">
            {sims.map((n) => {
              const isDone = completedSims.has(n.id);
              const open = isDone || isUnlocked(n, completed) || unlockedSet.has(n.id);
              const state = isDone ? "completed" : open ? "open" : "locked";
              return (
                <SimCard
                  key={n.id}
                  simId={n.id}
                  title={n.title}
                  glyph={n.glyph}
                  blurb={blurbFor(n.id) ?? ""}
                  state={state}
                  price={priceFor(n.id)}
                  xp={xp}
                />
              );
            })}
          </div>
        </section>

        <section className="sims-lvl">
          <div className="prow">
            <span className="plab">Level 2</span>
          </div>
          <div className="sims-soon" aria-disabled="true">
            <span className="sims-soon-ic">🔒</span>
            <div className="sims-soon-copy">
              <span className="sims-soon-title">Level 2 · Coming soon</span>
              <span className="sims-soon-sub">Finish Level 1 to reveal the next set.</span>
            </div>
          </div>
        </section>

        <section className="sims-lvl">
          <div className="prow">
            <span className="plab">Level 3</span>
          </div>
          <div className="sims-soon" aria-disabled="true">
            <span className="sims-soon-ic">🔒</span>
            <div className="sims-soon-copy">
              <span className="sims-soon-title">Level 3 · Coming soon</span>
              <span className="sims-soon-sub">The capstone simulations land in a future update.</span>
            </div>
          </div>
        </section>
      </main>

      <TabBar avatarKey={profile?.avatar_key} />
    </div>
  );
}
