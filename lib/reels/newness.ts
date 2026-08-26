import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Does this user have unseen approved reels? True when the newest approved reel
 * was added to the catalog (reels.created_at) after the user last opened the
 * feed (profiles.reels_seen_at). Drives the "New" badge on the Reels tab.
 *
 * Cheap: one indexed row from each side. Never throws — on any error we simply
 * don't show the badge (a missing badge is harmless; a crashed nav is not).
 */
export async function reelsHasNew(supabase: ServerClient, userId: string): Promise<boolean> {
  try {
    const [newestRes, profileRes] = await Promise.all([
      supabase
        .from("reels")
        .select("created_at")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("profiles").select("reels_seen_at").eq("id", userId).maybeSingle(),
    ]);

    const newestAt = newestRes.data?.created_at as string | undefined;
    if (!newestAt) return false; // catalog empty → nothing new

    const seenRaw = profileRes.data?.reels_seen_at as string | null | undefined;
    const seenMs = seenRaw ? new Date(seenRaw).getTime() : 0;
    return new Date(newestAt).getTime() > seenMs;
  } catch {
    return false;
  }
}

/** Mark the feed as seen (called when the user opens /reels), clearing the badge. */
export async function markReelsSeen(supabase: ServerClient, userId: string): Promise<void> {
  try {
    await supabase.from("profiles").update({ reels_seen_at: new Date().toISOString() }).eq("id", userId);
  } catch {
    /* non-fatal: worst case the badge lingers until the next visit */
  }
}
