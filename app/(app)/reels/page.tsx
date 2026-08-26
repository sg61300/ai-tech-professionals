import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReelsFeed, type Reel } from "@/components/reels/ReelsFeed";
import { toggleReelInteraction, recordReelWatch } from "./actions";
import { TabBar } from "@/components/app/TabBar";
import { markReelsSeen } from "@/lib/reels/newness";

export const dynamic = "force-dynamic";

/**
 * Reels (PRD/14): a vertical feed of approved short videos. Curation lives in the
 * `reels` table (status='approved'); until it's seeded, the feed shows the
 * caught-up empty state. Like/Save/Share/Report + capped watch-XP are wired to
 * server actions.
 */
export default async function ReelsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_key, onboarding_complete")
    .eq("id", user.id)
    .single();
  if (!profile?.onboarding_complete) redirect("/onboarding");

  // Pool a LARGE window of approved reels (not just the newest few) so that as
  // the daily auto-pull keeps adding videos, OLDER reels stay in rotation too —
  // then shuffle for a random feed order each visit. The rows are tiny (5 cols),
  // so a 500-cap is effectively "all" at MVP scale (months of runway) while
  // still bounding memory if the table ever grows very large.
  const { data: reelRows } = await supabase
    .from("reels")
    .select("id, youtube_id, title, channel, topic")
    .eq("status", "approved")
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(500);

  const mapped: Reel[] = (reelRows ?? []).map((r) => ({
    id: r.id as number,
    youtubeId: r.youtube_id as string,
    title: (r.title as string) ?? "AI for HR",
    channel: (r.channel as string) ?? null,
    topic: (r.topic as string) ?? null,
  }));

  // Fisher-Yates shuffle (server-side, per request) for a random feed order.
  const reels: Reel[] = [...mapped];
  for (let i = reels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [reels[i], reels[j]] = [reels[j], reels[i]];
  }

  const reelIds = reels.map((r) => r.id);
  const { data: interactions } = reelIds.length
    ? await supabase
        .from("reel_interactions")
        .select("reel_id, type")
        .eq("user_id", user.id)
        .in("reel_id", reelIds)
    : { data: [] as { reel_id: number; type: string }[] };

  const pick = (t: string) =>
    (interactions ?? []).filter((i) => i.type === t).map((i) => i.reel_id as number);

  async function toggle(
    reelId: number,
    type: "like" | "save" | "share" | "report",
    reason?: string,
  ) {
    "use server";
    return toggleReelInteraction(reelId, type, reason);
  }
  async function watch(reelId: number) {
    "use server";
    return recordReelWatch(reelId);
  }

  // Opening the feed clears the "New" badge on the Reels tab.
  await markReelsSeen(supabase, user.id);

  return (
    <div className="lh">
      <ReelsFeed
        reels={reels}
        initialLiked={pick("like")}
        initialSaved={pick("save")}
        watchedIds={pick("watch")}
        onToggle={toggle}
        onWatch={watch}
      />
      <TabBar avatarKey={profile?.avatar_key} reelsNew={false} />
    </div>
  );
}
