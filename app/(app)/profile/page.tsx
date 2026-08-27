import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display";
import { levelProgress } from "@/lib/xp";
import { tasteSim, emailSim, systemSim } from "@/content";
import { TabBar } from "@/components/app/TabBar";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { SavedArtifacts, type Artifact } from "@/components/profile/SavedArtifacts";
import { XpProgress } from "@/components/brand/XpInfo";
import { EditableDetails } from "@/components/profile/EditableDetails";
import { ReferralShareCard, ApplyReferralCard } from "@/components/profile/ReferralCards";
import { getOrCreateReferralCode } from "@/app/actions/referral";
import { seniorityLabel, professionLabel } from "@/lib/profile/labels";
import { reelsHasNew } from "@/lib/reels/newness";
import "@/components/profile/profile.css";

export const dynamic = "force-dynamic";

const SIM_BADGE: Record<string, { name: string; emoji: string }> = {
  [tasteSim.id]: { name: tasteSim.badge, emoji: "✍️" },
  [emailSim.id]: { name: emailSim.badge, emoji: "📥" },
  [systemSim.id]: { name: systemSim.badge, emoji: "🗺️" },
};

/** Profile / second brain / settings (PRD/16). Reads live data; edit of details is a later slice. */
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "name, avatar_name, avatar_key, mobile, xp, level, streak_count, longest_streak, profession, seniority, ai_proficiency, onboarding_complete, referred_by",
    )
    .eq("id", user.id)
    .single();
  if (!profile?.onboarding_complete) redirect("/onboarding");

  const [{ data: progressRows }, { data: sims }, { data: arts }] = await Promise.all([
    supabase.from("lesson_progress").select("lesson_id").eq("user_id", user.id).eq("status", "done"),
    supabase.from("sim_completions").select("sim_id").eq("user_id", user.id),
    supabase
      .from("saved_artifacts")
      .select("id, title, source_sim, body, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const reelsNew = await reelsHasNew(supabase, user.id);

  const name = displayName(profile ?? {});
  const xp = profile?.xp ?? 0;
  const streak = profile?.streak_count ?? 0;
  const best = Math.max(profile?.longest_streak ?? 0, streak);
  const { level, progress } = levelProgress(xp);

  const doneIds = new Set((progressRows ?? []).map((r) => r.lesson_id as string));
  const lessonsDone = [...doneIds].filter((id) => id.startsWith("l")).length;
  const simIds = new Set((sims ?? []).map((s) => s.sim_id as string));

  // Earned badges, deduped.
  const badges: { name: string; emoji: string }[] = [];
  for (const id of simIds) if (SIM_BADGE[id]) badges.push(SIM_BADGE[id]);
  if (doneIds.has("rf1")) badges.push({ name: "Quick Thinker", emoji: "⚡" });
  if (lessonsDone >= 1) badges.push({ name: "First Steps", emoji: "🌱" });
  if (best >= 7) badges.push({ name: "Week Warrior", emoji: "🔥" });
  else if (best >= 3) badges.push({ name: "On a Roll", emoji: "🔥" });

  const artifacts = (arts ?? []) as Artifact[];

  // Referral (ADR-020): everyone can share; the "have a code?" input only shows
  // while the user is still eligible (no code applied + taste sim not done).
  // Build the invite link server-side from the request host so the client card
  // needs no browser-origin effect. This is the PLAIN app URL (no ?ref): the
  // friend opens the app and types the shared code into the signup prompt —
  // attribution is via the code, not the link (user decision, Session 23).
  const referralCode = await getOrCreateReferralCode();
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "";
  const referralLink = host ? `${proto}://${host}/` : null;
  // Show the apply section until the taste sim is done (the value window). If a
  // code is already applied, the card shows the persistent "applied" confirmation
  // instead of the input — so the user keeps seeing it worked until they play.
  const referralApplied = !!profile?.referred_by;
  const showReferralApply = !simIds.has(tasteSim.id);

  return (
    <div className="lh">
      {/* Fixed identity + stats; only the sections below scroll. */}
      <div className="pf-top">
        <header className="pf-head">
          <div className="pf-av">
            {profile?.avatar_key ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/avatars/${profile.avatar_key}.png`} alt="" />
            ) : (
              <span aria-hidden>{name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="pf-id">
            <h1 className="pf-name">{name}</h1>
            <p className="pf-role">
              {seniorityLabel(profile?.seniority) ?? "-"} · {professionLabel(profile?.profession) ?? "-"}
            </p>
          </div>
        </header>

        <XpProgress level={level} xp={xp} progress={progress} />

        <div className="pf-stats">
          <Link href="/learn/streak?from=profile" className="pf-stat pf-stat-link" aria-label="Open streak calendar">
            <b>🔥 {streak}</b>
            <span>Streak</span>
          </Link>
          <div className="pf-stat">
            <b>{lessonsDone}</b>
            <span>Lessons</span>
          </div>
          <div className="pf-stat">
            <b>{simIds.size}</b>
            <span>Sims</span>
          </div>
          <div className="pf-stat">
            <b>{badges.length}</b>
            <span>Badges</span>
          </div>
        </div>
      </div>

      <main className="pf-content">
        {/* Badges */}
        {badges.length > 0 && (
          <section className="pf-sec">
            <h2 className="pf-sec-h">Badges</h2>
            <div className="pf-badges">
              {badges.map((b) => (
                <span key={b.name} className="pf-badge" title={b.name}>
                  <i aria-hidden>{b.emoji}</i>
                  {b.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Invite friends (referral — ADR-020) */}
        <section className="pf-sec">
          <h2 className="pf-sec-h">🎁 Invite friends</h2>
          <p className="pf-sec-sub">Share the app. When a friend finishes their taste simulation, you both earn a bonus.</p>
          {referralLink && referralCode && (
            <ReferralShareCard code={referralCode} link={referralLink} />
          )}
          {showReferralApply && <ApplyReferralCard alreadyApplied={referralApplied} />}
        </section>

        {/* Details (editable — grilled design, Session 14) */}
        <section className="pf-sec">
          <h2 className="pf-sec-h">
            <span style={{ fontSize: "1.35em", verticalAlign: "-0.1em" }} aria-hidden>🪪</span> The real you
          </h2>
          <EditableDetails
            initial={{
              name: profile?.name ?? null,
              email: user.email ?? null,
              mobile: profile?.mobile ?? null,
              seniority: profile?.seniority ?? null,
              profession: profile?.profession ?? null,
              ai_proficiency: profile?.ai_proficiency ?? null,
            }}
          />
        </section>

        {/* Second brain */}
        <section className="pf-sec">
          <h2 className="pf-sec-h">🧠 Your second brain</h2>
          <p className="pf-sec-sub">Your greatest hits. Steal from yourself. That&apos;s the whole point.</p>
          <SavedArtifacts items={artifacts} />
        </section>

        {/* Settings */}
        <section className="pf-sec">
          <h2 className="pf-sec-h">⚙️ Settings</h2>
          <div className="pf-rows">
            <div className="pf-row">
              <span>Appearance</span>
              <span className="pf-row-v">Toggle light / dark top-right</span>
            </div>
            <div className="pf-row">
              <span>Connect your own AI key</span>
              <span className="pf-row-v soon">Coming soon</span>
            </div>
            <div className="pf-row col">
              <span>Privacy</span>
              <span className="pf-row-v">
                Practice on sample data, never real employee records.
              </span>
            </div>
          </div>
          <div className="pf-signout">
            <SignOutButton />
          </div>
        </section>

        <p className="pf-foot">AI &amp; Tech for Professionals · Level 1</p>
      </main>

      <TabBar avatarKey={profile?.avatar_key} reelsNew={reelsNew} />
    </div>
  );
}
