import { z } from "zod";
import type { BiasSim, BiasGoldenRank } from "@/content/schema";

/**
 * Bias Catcher engine (spec §4.3). Pure + deterministic: the audit + fix checks
 * and the two authored golden rankings are the source of truth. The live AI
 * rankings are decoration on top (with a golden fallback) and never affect
 * correctness. No IO; TDD'd and shared by the runner + the server action.
 */

export type BiasPhase = "biased" | "fair";
export type BiasRankItem = { rank: number; candidateId: string; reason: string };
export type BiasRanking = { ranking: BiasRankItem[] };

/** Set equality helper. */
const sameSet = (a: string[], b: string[]): boolean => {
  const A = new Set(a);
  const B = new Set(b);
  return A.size === B.size && [...A].every((x) => B.has(x));
};

/**
 * The audit (beat 4): the learner must flag EXACTLY the reasons that shouldn't
 * matter (college pedigree, the gap) — no more, no less.
 */
export function auditPassed(sim: BiasSim, selectedReasonIds: string[]): boolean {
  const biased = sim.auditReasons.filter((r) => r.biased).map((r) => r.id);
  return sameSet(selectedReasonIds, biased);
}

/**
 * The fix (beat 5): a fair fix turns ON every debiasing toggle and leaves every
 * non-debiasing distractor OFF.
 */
export function fixApplied(sim: BiasSim, selectedToggleIds: string[]): boolean {
  const debiasing = sim.fixToggles.filter((t) => t.debiasing).map((t) => t.id);
  return sameSet(selectedToggleIds, debiasing);
}

/** The effect strings for the selected fix toggles (folded into the round-2 prompt). */
export function selectedFixEffects(sim: BiasSim, selectedToggleIds: string[]): string[] {
  const set = new Set(selectedToggleIds);
  return sim.fixToggles.filter((t) => set.has(t.id)).map((t) => t.effect);
}

/** Scripted fallback ranking for a phase (the authored golden). */
export function biasRankGolden(sim: BiasSim, phase: BiasPhase): BiasRanking {
  const golden: BiasGoldenRank[] = phase === "biased" ? sim.goldenBiased : sim.goldenFair;
  return { ranking: golden };
}

/**
 * The Zod contract for a live ranking: an object with a `ranking` array that is a
 * full PERMUTATION of the sim's candidate ids (each candidate exactly once). Used
 * by `callJsonAI`, so a hallucinated / partial / duplicated ranking falls back to
 * the golden. Built per-sim because the valid id set is the sim's own.
 */
export function buildRankSchema(sim: BiasSim): z.ZodType<BiasRanking> {
  const ids = sim.candidates.map((c) => c.id);
  return z
    .object({
      ranking: z
        .array(
          z.object({
            rank: z.number().int(),
            candidateId: z.string().min(1),
            reason: z.string().min(1),
          }),
        )
        .length(ids.length),
    })
    .refine((v) => sameSet(v.ranking.map((r) => r.candidateId), ids), {
      message: "ranking must be a permutation of the candidate ids",
      path: ["ranking"],
    }) as unknown as z.ZodType<BiasRanking>;
}

/** Order the candidates by a ranking (rank ascending); used to render the before/after. */
export function orderByRanking<T extends { candidateId: string; rank: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.rank - b.rank);
}
