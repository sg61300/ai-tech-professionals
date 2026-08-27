/**
 * Referral feature — pure logic (ADR-020, grilled in Session 21).
 *
 * A user shares an invite link carrying their unique code. When the INVITEE
 * completes their taste sim (first real value), both sides earn REFERRAL_XP
 * into the single visible XP balance — no second currency (R1). Rewards are
 * capped per referrer (R3), applied once per invitee (R4), server-side and
 * idempotent. A code may only be applied BEFORE the invitee has completed their
 * own taste sim (Q6) — that "value window" blocks veteran-vs-veteran farming
 * without a brittle date window.
 *
 * These functions are pure so they can be TDD'd and reused by the Server
 * Actions (attribution + reward). All DB reads/writes live in the actions.
 */

/** XP granted to EACH side (referrer + invitee) on a rewarded referral (R1). */
export const REFERRAL_XP = 100;
/** Max rewarded referrals a single referrer can earn (R3). */
export const REFERRAL_CAP = 10;

/** Unambiguous code alphabet — no 0/O/1/I/L/U (misread-prone / word-forming). */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
/** Referral code length. */
const CODE_LEN = 7;

/**
 * Normalize a user-entered / URL code to its canonical form: uppercased, all
 * whitespace stripped. Returns "" for anything unusable so callers never
 * resolve a referrer from junk input.
 */
export function normalizeCode(raw: string): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, "").toUpperCase();
}

/**
 * Generate a shareable referral code. `rand` is injectable (defaults to
 * Math.random) so the code is deterministic under test. Uniqueness is enforced
 * by the DB unique constraint + a retry at the call site, not here.
 */
export function generateReferralCode(rand: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    const idx = Math.min(ALPHABET.length - 1, Math.floor(rand() * ALPHABET.length));
    out += ALPHABET[idx];
  }
  return out;
}

/** A user cannot refer themselves (R4). */
export function isSelfReferral(inviteeId: string, referrerId: string): boolean {
  return inviteeId === referrerId;
}

/** Whether a referrer is still under the per-referrer reward cap (R3). */
export function canGrantReward(referrerRewardCount: number, cap: number = REFERRAL_CAP): boolean {
  return referrerRewardCount < cap;
}

export type ApplyContext = {
  /** The submitted code resolved to an existing user. */
  referrerExists: boolean;
  /** The referrer resolves to the invitee themselves. */
  isSelf: boolean;
  /** The invitee already has a `referred_by` set (apply-once, R4). */
  inviteeAlreadyReferred: boolean;
  /** The invitee has already completed their own taste sim (value window, Q6). */
  inviteeCompletedTaste: boolean;
};

export type ApplyDecision =
  | { ok: true }
  | {
      ok: false;
      reason: "unknown_code" | "self_referral" | "already_referred" | "value_window_closed";
    };

/**
 * Decide whether an invitee may apply a referral code. Pure — the action
 * gathers the flags from the DB and persists `referred_by` only when ok.
 */
export function evaluateApply(ctx: ApplyContext): ApplyDecision {
  if (!ctx.referrerExists) return { ok: false, reason: "unknown_code" };
  if (ctx.isSelf) return { ok: false, reason: "self_referral" };
  if (ctx.inviteeAlreadyReferred) return { ok: false, reason: "already_referred" };
  if (ctx.inviteeCompletedTaste) return { ok: false, reason: "value_window_closed" };
  return { ok: true };
}

export type RewardContext = {
  /** Payout flag (REFERRAL_REWARDS_ENABLED). */
  rewardsEnabled: boolean;
  /** The activating invitee. */
  inviteeId: string;
  /** Who referred them (profiles.referred_by), or null if not referred. */
  referrerId: string | null;
  /** The referrer's existing rewarded-referral count (the 10-cap counter). */
  rewardCount: number;
};

export type RewardDecision =
  | { grant: true }
  | { grant: false; reason: "rewards_disabled" | "not_referred" | "self_referral" | "cap_reached" };

/**
 * Decide whether to pay out a referral reward when an invitee activates. Pure —
 * the action gathers the facts (flag, referred_by, per-referrer count) and only
 * writes the ledger + credits XP when this returns grant. The insert-first
 * unique(invitee_id) lock in the action is the separate atomic guard against a
 * replay/race actually double-paying; this function is the eligibility gate.
 * Order matters: a disabled flag short-circuits everything.
 */
export function decideReferralReward(ctx: RewardContext): RewardDecision {
  if (!ctx.rewardsEnabled) return { grant: false, reason: "rewards_disabled" };
  if (!ctx.referrerId) return { grant: false, reason: "not_referred" };
  if (isSelfReferral(ctx.inviteeId, ctx.referrerId)) return { grant: false, reason: "self_referral" };
  if (!canGrantReward(ctx.rewardCount)) return { grant: false, reason: "cap_reached" };
  return { grant: true };
}

/** One granted referral reward, from the referrer's point of view (only the XP matters here). */
export type ReferrerRewardRow = { xp_each: number };

export type ReferrerRewardSummary = {
  /** How many friends the unseen rewards cover. */
  count: number;
  /** Total XP the referrer earned across them. */
  totalXp: number;
  /** Banner headline. */
  title: string;
  /** Banner supporting line. */
  subtitle: string;
};

/**
 * Aggregate a referrer's UNSEEN granted rewards into a single banner summary
 * (the notifier, Session 23). Pure so the `/learn` server component can TDD the
 * copy and the DB layer just supplies the rows. Returns null when there is
 * nothing unseen, so the caller renders no banner. Sums `xp_each` rather than
 * assuming a fixed amount, and collapses many rewards into ONE summed message
 * instead of stacking a card per friend.
 */
export function summarizeReferrerRewards(rows: ReferrerRewardRow[]): ReferrerRewardSummary | null {
  if (!rows || rows.length === 0) return null;
  const count = rows.length;
  const totalXp = rows.reduce((sum, r) => sum + (r?.xp_each || 0), 0);
  const who = count === 1 ? "A friend you invited" : `${count} friends you invited`;
  const title = `${who} got started. You earned +${totalXp} XP`;
  const subtitle =
    count === 1
      ? "They finished their taste simulation. Nice work spreading the word."
      : "They each finished their taste simulation. Keep inviting from your profile.";
  return { count, totalXp, title, subtitle };
}
