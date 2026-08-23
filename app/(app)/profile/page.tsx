import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display";
import { levelProgress } from "@/lib/xp";
import { tasteSim, emailSim, systemSim } from "@/content";
import { TabBar } from "@/components/app/TabBar";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { SavedArtifacts, type Artifact } from "@/components/profile/SavedArtifacts";
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
      "name, avatar_name, avatar_key, mobile, xp, level, streak_count, longest_streak, profession, seniority, ai_proficiency, onboarding_complete",
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
  const detail = (v?: string | null) => (v && v.trim() ? v : "—");

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
              {detail(profile?.seniority)} · {detail(profile?.profession)}
            </p>
          </div>
        </header>

        <div className="pf-xp">
          <div className="pf-xp-row">
            <span>Level {level}</span>
            <span>{xp.toLocaleString()} XP</span>
          </div>
          <div className="pf-bar">
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>

        <div className="pf-stats">
          <div className="pf-stat">
            <b>🔥 {streak}</b>
            <span>Streak</span>
          </div>
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

        {/* Details */}
        <section className="pf-sec">
          <h2 className="pf-sec-h">Your details</h2>
          <dl className="pf-details">
            <div>
              <dt>Name</dt>
              <dd>{detail(profile?.name)}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Mobile</dt>
              <dd>{detail(profile?.mobile)}</dd>
            </div>
            <div>
              <dt>Organization role</dt>
              <dd>{detail(profile?.seniority)}</dd>
            </div>
            <div>
              <dt>Profession</dt>
              <dd>{detail(profile?.profession)}</dd>
            </div>
            <div>
              <dt>AI proficiency</dt>
              <dd>{detail(profile?.ai_proficiency)}</dd>
            </div>
          </dl>
          <p className="pf-note">Editing your details is coming soon.</p>
        </section>

        {/* Second brain */}
        <section className="pf-sec">
          <h2 className="pf-sec-h">🧠 Your second brain</h2>
          <p className="pf-sec-sub">Your greatest hits. Steal from yourself — that&apos;s the whole point.</p>
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
                Practice on sample data — never real employee records.
              </span>
            </div>
          </div>
          <div className="pf-signout">
            <SignOutButton />
          </div>
        </section>

        <p className="pf-foot">AI &amp; Tech for Professionals · Level 1</p>
      </main>

      <TabBar avatarKey={profile?.avatar_key} />
    </div>
  );
}
