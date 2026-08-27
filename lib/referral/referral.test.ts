import { describe, it, expect } from "vitest";
import {
  REFERRAL_CAP,
  normalizeCode,
  generateReferralCode,
  isSelfReferral,
  canGrantReward,
  evaluateApply,
  decideReferralReward,
  summarizeReferrerRewards,
  REFERRAL_XP,
} from "./index";

describe("normalizeCode", () => {
  it("uppercases and trims surrounding whitespace", () => {
    expect(normalizeCode("  ab3cd7  ")).toBe("AB3CD7");
  });

  it("strips a stray inner space", () => {
    expect(normalizeCode("AB3 CD7")).toBe("AB3CD7");
  });

  it("returns empty string for non-string input", () => {
    // Applying an empty/garbage code must never resolve a referrer.
    expect(normalizeCode(undefined as unknown as string)).toBe("");
    expect(normalizeCode("   ")).toBe("");
  });
});

describe("generateReferralCode", () => {
  it("produces a 7-char code from the unambiguous alphabet", () => {
    // A deterministic rand lets us assert the exact code.
    const seq = [0, 0.999999, 0.5, 0, 0.999999, 0.5, 0];
    let i = 0;
    const code = generateReferralCode(() => seq[i++]);
    expect(code).toHaveLength(7);
    // No ambiguous glyphs (0/O/1/I/L) may appear.
    expect(code).not.toMatch(/[01OIL]/);
  });

  it("only ever emits alphabet characters", () => {
    for (let n = 0; n < 200; n++) {
      const code = generateReferralCode(Math.random);
      expect(code).toMatch(/^[2-9A-HJ-NP-Z]{7}$/);
    }
  });
});

describe("isSelfReferral", () => {
  it("is true when invitee and referrer are the same user", () => {
    expect(isSelfReferral("u1", "u1")).toBe(true);
  });

  it("is false for two different users", () => {
    expect(isSelfReferral("u1", "u2")).toBe(false);
  });
});

describe("canGrantReward", () => {
  it("allows a reward while under the cap", () => {
    expect(canGrantReward(0)).toBe(true);
    expect(canGrantReward(REFERRAL_CAP - 1)).toBe(true);
  });

  it("blocks a reward at or over the cap", () => {
    expect(canGrantReward(REFERRAL_CAP)).toBe(false);
    expect(canGrantReward(REFERRAL_CAP + 3)).toBe(false);
  });
});

describe("evaluateApply", () => {
  const base = {
    referrerExists: true,
    isSelf: false,
    inviteeAlreadyReferred: false,
    inviteeCompletedTaste: false,
  };

  it("accepts a first-time, value-eligible, non-self apply", () => {
    expect(evaluateApply(base)).toEqual({ ok: true });
  });

  it("rejects an unknown code", () => {
    expect(evaluateApply({ ...base, referrerExists: false })).toEqual({
      ok: false,
      reason: "unknown_code",
    });
  });

  it("rejects self-referral", () => {
    expect(evaluateApply({ ...base, isSelf: true })).toEqual({
      ok: false,
      reason: "self_referral",
    });
  });

  it("rejects applying a second code (apply-once)", () => {
    expect(evaluateApply({ ...base, inviteeAlreadyReferred: true })).toEqual({
      ok: false,
      reason: "already_referred",
    });
  });

  it("rejects a code applied after the invitee's own taste sim (value window closed)", () => {
    expect(evaluateApply({ ...base, inviteeCompletedTaste: true })).toEqual({
      ok: false,
      reason: "value_window_closed",
    });
  });
});

describe("decideReferralReward", () => {
  const base = {
    rewardsEnabled: true,
    inviteeId: "invitee",
    referrerId: "referrer",
    rewardCount: 0,
  };

  it("grants when enabled, referred by someone else, and under the cap", () => {
    expect(decideReferralReward(base)).toEqual({ grant: true });
  });

  it("skips with rewards_disabled when the payout flag is off", () => {
    expect(decideReferralReward({ ...base, rewardsEnabled: false })).toEqual({
      grant: false,
      reason: "rewards_disabled",
    });
  });

  it("skips with not_referred when the invitee has no referrer", () => {
    expect(decideReferralReward({ ...base, referrerId: null })).toEqual({
      grant: false,
      reason: "not_referred",
    });
  });

  it("skips with self_referral when referrer equals invitee", () => {
    expect(decideReferralReward({ ...base, referrerId: "invitee" })).toEqual({
      grant: false,
      reason: "self_referral",
    });
  });

  it("skips with cap_reached when the referrer is at the cap", () => {
    expect(decideReferralReward({ ...base, rewardCount: REFERRAL_CAP })).toEqual({
      grant: false,
      reason: "cap_reached",
    });
  });

  it("checks the disabled flag before anything else (no referrer + disabled → disabled)", () => {
    expect(decideReferralReward({ ...base, rewardsEnabled: false, referrerId: null })).toEqual({
      grant: false,
      reason: "rewards_disabled",
    });
  });

  it("checks self-referral before the cap", () => {
    expect(
      decideReferralReward({ ...base, referrerId: "invitee", rewardCount: REFERRAL_CAP }),
    ).toEqual({ grant: false, reason: "self_referral" });
  });
});

describe("summarizeReferrerRewards", () => {
  it("returns null when there are no unseen rewards (nothing to show)", () => {
    expect(summarizeReferrerRewards([])).toBeNull();
  });

  it("summarizes a single reward with singular copy", () => {
    const s = summarizeReferrerRewards([{ xp_each: REFERRAL_XP }]);
    expect(s).not.toBeNull();
    expect(s!.count).toBe(1);
    expect(s!.totalXp).toBe(100);
    expect(s!.title).toBe("A friend you invited got started. You earned +100 XP");
    expect(s!.subtitle).toContain("taste simulation");
  });

  it("aggregates multiple rewards into one summed banner with plural copy", () => {
    const s = summarizeReferrerRewards([
      { xp_each: 100 },
      { xp_each: 100 },
      { xp_each: 100 },
    ]);
    expect(s!.count).toBe(3);
    expect(s!.totalXp).toBe(300);
    expect(s!.title).toBe("3 friends you invited got started. You earned +300 XP");
  });

  it("sums heterogeneous xp_each values (never assumes a fixed amount)", () => {
    const s = summarizeReferrerRewards([{ xp_each: 100 }, { xp_each: 50 }]);
    expect(s!.count).toBe(2);
    expect(s!.totalXp).toBe(150);
    expect(s!.title).toBe("2 friends you invited got started. You earned +150 XP");
  });

  it("tolerates a missing xp_each as 0 (defensive against bad rows)", () => {
    const s = summarizeReferrerRewards([{ xp_each: 100 }, {} as { xp_each: number }]);
    expect(s!.count).toBe(2);
    expect(s!.totalXp).toBe(100);
  });
});
