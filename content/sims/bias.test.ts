import { describe, it, expect } from "vitest";
import { BiasSimSchema } from "@/content/schema";
import { BIAS_SIM } from "@/content/sims/bias";

describe("BIAS_SIM content", () => {
  it("parses against the BiasSim schema", () => {
    expect(() => BiasSimSchema.parse(BIAS_SIM)).not.toThrow();
  });

  it("has 6 candidates with the seeded college + gap noise", () => {
    expect(BIAS_SIM.candidates).toHaveLength(6);
    expect(BIAS_SIM.candidates.some((c) => c.eliteCollege)).toBe(true);
    expect(BIAS_SIM.candidates.some((c) => !c.eliteCollege)).toBe(true);
    const gapped = BIAS_SIM.candidates.filter((c) => c.hasGap);
    expect(gapped.length).toBeGreaterThan(0);
    for (const c of gapped) expect(c.gapNote).toBeTruthy();
  });

  it("both golden rankings are a permutation of the candidate ids", () => {
    const ids = BIAS_SIM.candidates.map((c) => c.id).sort();
    for (const g of [BIAS_SIM.goldenBiased, BIAS_SIM.goldenFair]) {
      expect(g.map((r) => r.candidateId).sort()).toEqual(ids);
    }
  });

  it("makes the before/after swap visible (a strong-merit candidate rises, a pedigree pick falls)", () => {
    const rankOf = (g: typeof BIAS_SIM.goldenBiased, id: string) =>
      g.find((r) => r.candidateId === id)!.rank;
    // Meera (c3): buried by the naive prompt, lifted by the fair one.
    expect(rankOf(BIAS_SIM.goldenBiased, "c3")).toBeGreaterThan(rankOf(BIAS_SIM.goldenFair, "c3"));
    // Rohan (c5): rides the college halo up, drops when it's removed.
    expect(rankOf(BIAS_SIM.goldenFair, "c5")).toBeGreaterThan(rankOf(BIAS_SIM.goldenBiased, "c5"));
  });

  it("has at least one biased audit reason and the debiasing fix toggles", () => {
    expect(BIAS_SIM.auditReasons.filter((r) => r.biased).length).toBeGreaterThanOrEqual(2);
    expect(BIAS_SIM.fixToggles.filter((t) => t.debiasing).length).toBeGreaterThanOrEqual(3);
    expect(BIAS_SIM.fixToggles.some((t) => !t.debiasing)).toBe(true); // at least one distractor
  });

  it("uses no em dashes in learner-facing copy (house rule)", () => {
    const copy = [
      BIAS_SIM.intro.copy,
      BIAS_SIM.hook,
      BIAS_SIM.stackCopy,
      BIAS_SIM.round1Copy,
      BIAS_SIM.auditCopy,
      BIAS_SIM.fixCopy,
      BIAS_SIM.round2Copy,
      BIAS_SIM.celebration.copy,
      ...BIAS_SIM.candidates.map((c) => c.merit),
      ...BIAS_SIM.grillBeat.branches.map((b) => b.retort),
    ].join(" ");
    expect(copy).not.toContain("—");
  });
});
