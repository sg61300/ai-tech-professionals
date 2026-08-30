import { describe, it, expect } from "vitest";
import { BIAS_SIM } from "@/content/sims/bias";
import { auditPassed, fixApplied, biasRankGolden, buildRankSchema } from "./index";

const sim = BIAS_SIM;
const biasedIds = sim.auditReasons.filter((r) => r.biased).map((r) => r.id);
const debiasingIds = sim.fixToggles.filter((t) => t.debiasing).map((t) => t.id);
const distractorId = sim.fixToggles.find((t) => !t.debiasing)!.id;

describe("auditPassed", () => {
  it("passes only when EXACTLY the biased reasons are flagged", () => {
    expect(auditPassed(sim, biasedIds)).toBe(true);
  });
  it("fails when a legitimate reason is also flagged", () => {
    const legit = sim.auditReasons.find((r) => !r.biased)!.id;
    expect(auditPassed(sim, [...biasedIds, legit])).toBe(false);
  });
  it("fails when a biased reason is missed", () => {
    expect(auditPassed(sim, biasedIds.slice(0, 1))).toBe(false);
  });
  it("fails on an empty selection", () => {
    expect(auditPassed(sim, [])).toBe(false);
  });
});

describe("fixApplied", () => {
  it("passes when all debiasing toggles are on and no distractor is on", () => {
    expect(fixApplied(sim, debiasingIds)).toBe(true);
  });
  it("fails when the prestige distractor is selected", () => {
    expect(fixApplied(sim, [...debiasingIds, distractorId])).toBe(false);
  });
  it("fails when a debiasing toggle is missing", () => {
    expect(fixApplied(sim, debiasingIds.slice(0, 2))).toBe(false);
  });
});

describe("biasRankGolden", () => {
  it("returns the biased golden for round 1 and the fair golden for round 2", () => {
    expect(biasRankGolden(sim, "biased").ranking).toEqual(sim.goldenBiased);
    expect(biasRankGolden(sim, "fair").ranking).toEqual(sim.goldenFair);
  });
});

describe("buildRankSchema", () => {
  const schema = buildRankSchema(sim);
  const ids = sim.candidates.map((c) => c.id);

  it("accepts a valid full permutation ranking", () => {
    const ranking = ids.map((id, i) => ({ rank: i + 1, candidateId: id, reason: "ok" }));
    expect(schema.safeParse({ ranking }).success).toBe(true);
  });
  it("rejects a ranking that repeats a candidate (not a permutation)", () => {
    const ranking = ids.map((_id, i) => ({ rank: i + 1, candidateId: ids[0], reason: "dup" }));
    expect(schema.safeParse({ ranking }).success).toBe(false);
  });
  it("rejects a ranking referencing an unknown candidate id", () => {
    const ranking = ids.map((id, i) => ({ rank: i + 1, candidateId: i === 0 ? "ghost" : id, reason: "x" }));
    expect(schema.safeParse({ ranking }).success).toBe(false);
  });
  it("rejects the wrong number of entries", () => {
    const ranking = ids.slice(0, 3).map((id, i) => ({ rank: i + 1, candidateId: id, reason: "x" }));
    expect(schema.safeParse({ ranking }).success).toBe(false);
  });
});
