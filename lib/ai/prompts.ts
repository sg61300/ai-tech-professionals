import type { TasteSim } from "@/content/schema";

/**
 * Pure prompt assembly for the taste sim. Inputs are *indices* into the sim's
 * own curated content (never raw user text), so the composed prompt can only
 * ever contain strings we authored — injection- and DPDP-safe. Out-of-range
 * indices are dropped rather than trusted, so a tampered client can't inject.
 */
export type TasteSelections = {
  roleIndex: number;
  factIndices: number[];
  toggleIndices: number[];
};

const at = <T>(arr: T[], i: number): T | undefined =>
  Number.isInteger(i) && i >= 0 && i < arr.length ? arr[i] : undefined;

export function buildTastePrompt(sim: TasteSim, sel: TasteSelections): string {
  const role = at(sim.role.options, sel.roleIndex)?.value ?? "";
  const context = sel.factIndices
    .map((i) => at(sim.context.facts, i)?.value)
    .filter((v): v is string => Boolean(v))
    .join("; ");
  const format = sel.toggleIndices
    .map((i) => at(sim.format.toggles, i)?.value)
    .filter((v): v is string => Boolean(v))
    .join(", ");

  return sim.liveGen.promptTemplate
    .replace("{role}", role)
    .replace("{context}", context)
    .replace("{task}", sim.assembled.task)
    .replace("{format}", format);
}
