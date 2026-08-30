import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ensure a single "second brain" artifact exists for (user, sim), returning its
 * id (or null if it could not be created).
 *
 * Idempotent: if the user already has an artifact for this sim it returns the
 * existing id without inserting a duplicate; otherwise it inserts one. This is
 * what makes the profile second brain reliable — it writes the artifact on the
 * FIRST completion AND backfills it when an earlier completion never created one
 * (legacy rows, or the taste sim which historically saved nothing). Callers run
 * it on every completion, including the already-done path, so re-finishing a sim
 * always lands its output in the profile.
 */
export async function ensureSimArtifact(
  supabase: SupabaseClient,
  userId: string,
  a: { simId: string; title: string; body: string },
): Promise<number | null> {
  const { data: existing } = await supabase
    .from("saved_artifacts")
    .select("id")
    .eq("user_id", userId)
    .eq("source_sim", a.simId)
    .limit(1)
    .maybeSingle();
  const existingId = (existing as { id?: number } | null)?.id;
  if (existingId != null) return existingId;

  const { data: created } = await supabase
    .from("saved_artifacts")
    .insert({ user_id: userId, title: a.title, source_sim: a.simId, body: a.body })
    .select("id")
    .maybeSingle();
  return (created as { id?: number } | null)?.id ?? null;
}
