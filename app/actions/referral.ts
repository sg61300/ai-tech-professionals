"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureServer } from "@/lib/analytics/server";
import { EVENTS } from "@/lib/analytics/events";
import { applyXp } from "@/lib/xp";
import { tasteSim } from "@/content";
import {
  REFERRAL_XP,
  normalizeCode,
  generateReferralCode,
  isSelfReferral,
  evaluateApply,
  decideReferralReward,
} from "@/lib/referral";

/**
 * Master switch for referral PAYOUTS (Session 21, R5 "flag-gated"). Sharing and
 * attribution run regardless; XP is only granted when this is on, so the reward
 * can be watched for metric harm before it goes live. Set REFERRAL_REWARDS_ENABLED=true
 * in the environment to activate payouts.
 */
const REWARDS_ENABLED = process.env.REFERRAL_REWARDS_ENABLED === "true";

/**
 * Ensure the signed-in user has a referral code and return it. Lazily generated
 * on first read (share card / profile). Retries on the (rare) unique-code
 * collision. Owner-only RLS lets a user set their own code.
 */
export async function getOrCreateReferralCode(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", user.id)
    .single();
  if (profile?.referral_code) return profile.referral_code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const { error } = await supabase
      .from("profiles")
      .update({ referral_code: code })
      .eq("id", user.id)
      .is("referral_code", null);
    if (!error) return code;
    // Unique collision on the code value → try a different one. Any other error
    // (e.g. someone set it concurrently) → re-read below.
    const { data: again } = await supabase
      .from("profiles")
      .select("referral_code")
      .eq("id", user.id)
      .single();
    if (again?.referral_code) return again.referral_code;
  }
  return null;
}

export type ApplyResult =
  | { ok: true }
  | {
      ok: false;
      reason: "not_signed_in" | "unknown_code" | "self_referral" | "already_referred" | "value_window_closed";
    };

/**
 * Apply a referral code to the signed-in user. Entry points: signup (`via`
 * "signup") and the Profile "Have a referral code?" card (`via` "profile").
 * Resolves the code to a referrer via the service-role client (owner-only RLS
 * hides other users' profiles), then enforces: apply-once, no self-referral,
 * and the value window (only before the invitee's own taste sim). Idempotent.
 */
export async function applyReferralCode(rawCode: string, via: "signup" | "profile"): Promise<ApplyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "not_signed_in" };

  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, reason: "unknown_code" };

  const admin = createAdminClient();

  // Referrer lookup (bypasses RLS — reading another user's profile).
  const { data: referrer } = await admin
    .from("profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();

  // The invitee's own state.
  const { data: me } = await supabase
    .from("profiles")
    .select("referred_by")
    .eq("id", user.id)
    .single();
  const { data: taste } = await supabase
    .from("sim_completions")
    .select("id")
    .eq("user_id", user.id)
    .eq("sim_id", tasteSim.id)
    .limit(1)
    .maybeSingle();

  const decision = evaluateApply({
    referrerExists: !!referrer,
    isSelf: !!referrer && isSelfReferral(user.id, referrer.id),
    inviteeAlreadyReferred: !!me?.referred_by,
    inviteeCompletedTaste: !!taste,
  });
  if (!decision.ok) return decision;

  await supabase.from("profiles").update({ referred_by: referrer!.id }).eq("id", user.id);
  await captureServer(user.id, EVENTS.REFERRAL_CODE_APPLIED, { via });
  return { ok: true };
}

/**
 * Record that the user shared their invite through `channel` (whatsapp,
 * telegram, gmail, email, native, copy). Fire-and-forget analytics.
 */
export async function recordReferralShare(channel: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await captureServer(user.id, EVENTS.REFERRAL_LINK_SHARED, { channel });
}

/**
 * Grant the referral reward when `inviteeId` reaches first real value (their
 * taste sim). Called from completeTasteSim on FIRST completion only. Pays
 * REFERRAL_XP into BOTH sides' single XP balance (R1) via the service-role
 * client (cross-user write). Insert-first idempotency (unique invitee_id) +
 * per-referrer cap (R3). No-op unless payouts are enabled.
 */
/** What the invitee's completion flow learns about their referral payout (for the inline celebration line). */
export type GrantResult = { granted: boolean; xpEach: number };

const NO_GRANT: GrantResult = { granted: false, xpEach: 0 };

export async function grantReferralReward(inviteeId: string): Promise<GrantResult> {
  if (!REWARDS_ENABLED) return NO_GRANT; // short-circuit all DB work when payouts are off
  const admin = createAdminClient();

  const { data: invitee } = await admin
    .from("profiles")
    .select("referred_by, xp")
    .eq("id", inviteeId)
    .single();
  if (!invitee) return NO_GRANT; // no profile row → nothing to do
  const referrerId = (invitee.referred_by as string | null) ?? null;

  // Per-referrer cap counter — only needed when there IS a referrer.
  const { count } = referrerId
    ? await admin
        .from("referral_rewards")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", referrerId)
    : { count: 0 };

  // Eligibility gate (pure, TDD'd): flag / referred / not-self / under-cap.
  const decision = decideReferralReward({
    rewardsEnabled: REWARDS_ENABLED,
    inviteeId,
    referrerId,
    rewardCount: count ?? 0,
  });
  if (!decision.grant) return NO_GRANT;
  const refId = referrerId as string; // decision.grant guarantees a referrer

  // Insert-first idempotency: unique(invitee_id) is the atomic guard — a race /
  // replay bails here before any XP is credited, even if two calls both passed
  // the decision above.
  const { error: insErr } = await admin
    .from("referral_rewards")
    .insert({ referrer_id: refId, invitee_id: inviteeId, xp_each: REFERRAL_XP });
  if (insErr) return NO_GRANT; // already rewarded (unique violation) or transient — never double-pay

  const { data: referrer } = await admin
    .from("profiles")
    .select("xp")
    .eq("id", refId)
    .single();

  // Credit both sides; report level-ups.
  const inviteeXp = applyXp(invitee.xp ?? 0, REFERRAL_XP);
  await admin.from("profiles").update({ xp: inviteeXp.xp, level: inviteeXp.level }).eq("id", inviteeId);
  if (inviteeXp.leveledUp) await captureServer(inviteeId, EVENTS.LEVEL_UP, { level: inviteeXp.level });

  if (referrer) {
    const refXp = applyXp(referrer.xp ?? 0, REFERRAL_XP);
    await admin.from("profiles").update({ xp: refXp.xp, level: refXp.level }).eq("id", refId);
    if (refXp.leveledUp) await captureServer(refId, EVENTS.LEVEL_UP, { level: refXp.level });
  }

  await captureServer(refId, EVENTS.REFERRAL_REWARD_GRANTED, { xp_each: REFERRAL_XP, role: "referrer" });
  await captureServer(inviteeId, EVENTS.REFERRAL_REWARD_GRANTED, { xp_each: REFERRAL_XP, role: "invitee" });

  // The referrer's own +XP now sits UNSEEN in the ledger (seen_by_referrer defaults
  // false); their /learn banner picks it up. The invitee learns about it inline here.
  return { granted: true, xpEach: REFERRAL_XP };
}

/**
 * Mark all of the signed-in referrer's granted rewards as seen (banner dismissed,
 * Session 23). Owner-safe: RLS scopes referral_rewards to the referrer, and we
 * additionally filter on referrer_id = me. Revalidates /learn so the banner is
 * gone on the next render.
 */
export async function markReferralRewardsSeen(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  // referral_rewards has an RLS SELECT policy only (all writes go via service-role,
  // like grantReferralReward), so the owner client's UPDATE would silently affect
  // 0 rows and the banner would reappear. Use the admin client, still scoped to
  // THIS user's own referrer_id so a user can only clear their own rewards.
  const admin = createAdminClient();
  await admin
    .from("referral_rewards")
    .update({ seen_by_referrer: true })
    .eq("referrer_id", user.id)
    .eq("seen_by_referrer", false);
  revalidatePath("/learn");
}
