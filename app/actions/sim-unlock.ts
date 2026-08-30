"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureServer } from "@/lib/analytics/server";
import { EVENTS } from "@/lib/analytics/events";
import { applyXp } from "@/lib/xp";
import { priceFor } from "@/lib/simunlock";
import { L1_SPINE } from "@/content";
import { isUnlocked } from "@/lib/progression";

export type UnlockSimResult =
  | { ok: true; simId: string; xpSpent: number; newXp: number; newLevel: number }
  | {
      ok: false;
      error:
        | "not_signed_in" | "no_profile" | "unknown_sim"
        | "already_open" | "already_unlocked" | "insufficient_xp" | "unlock_failed";
    };

/**
 * Spend XP to permanently unlock a sim that the linear path has NOT unlocked yet
 * (Design/xp-sim-unlock-spec.md §6). Everything is re-derived server-side; the
 * client is never trusted for price or eligibility. Mirrors saveStreak's
 * insert-first idempotency, plus a `.gte("xp", price)` conditional deduct so two
 * concurrent unlocks for different sims can never over-draft the balance.
 */
export async function unlockSimWithXp(simId: string): Promise<UnlockSimResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_signed_in" };

  const price = priceFor(simId);
  if (price === null) return { ok: false, error: "unknown_sim" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("xp")
    .eq("id", user.id)
    .single();
  if (!profile) return { ok: false, error: "no_profile" };

  // Path already unlocks it → free, never charge.
  const { data: rows } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", user.id)
    .eq("status", "done");
  const completed = new Set((rows ?? []).map((r) => r.lesson_id));
  const node = L1_SPINE.find((n) => n.id === simId);
  if (node && isUnlocked(node, completed)) return { ok: false, error: "already_open" };

  if (profile.xp < price) return { ok: false, error: "insufficient_xp" };

  // Writes go through the service-role client: `sim_unlocks` is RLS SELECT-only
  // (a user-scoped insert is denied), and — crucially — this keeps a user from
  // POSTing a `sim_unlocks` row directly to unlock a sim for free. Same pattern
  // as the referral ledger (app/actions/referral.ts). Still scoped to user.id.
  const admin = createAdminClient();

  // Insert-first lock (unique(user_id,sim_id)); 23505 = already unlocked.
  const { error: insertErr } = await admin.from("sim_unlocks").insert({
    user_id: user.id,
    sim_id: simId,
    xp_spent: price,
    ahead_of_path: true,
  });
  if (insertErr) {
    return { ok: false, error: insertErr.code === "23505" ? "already_unlocked" : "unlock_failed" };
  }

  // Race-safe conditional deduct: only succeeds if the balance still covers it.
  const next = applyXp(profile.xp, -price);
  const { data: updated } = await admin
    .from("profiles")
    .update({ xp: next.xp, level: next.level })
    .eq("id", user.id)
    .gte("xp", price)
    .select("id");
  if (!updated || updated.length === 0) {
    // A concurrent spend dropped the balance below price — compensate.
    await admin.from("sim_unlocks").delete().eq("user_id", user.id).eq("sim_id", simId);
    return { ok: false, error: "insufficient_xp" };
  }

  await captureServer(user.id, EVENTS.SIM_UNLOCKED_VIA_XP, {
    sim_id: simId,
    xp_spent: price,
    ahead_of_path: true,
  });

  revalidatePath("/sims");
  revalidatePath("/learn");
  revalidatePath("/profile");

  return { ok: true, simId, xpSpent: price, newXp: next.xp, newLevel: next.level };
}
