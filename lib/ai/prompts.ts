import type { TasteSim, EmailSim, EmailRule } from "@/content/schema";

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

/**
 * Prompt for the email-sim's single live-AI flourish: a short, witty one-liner
 * about the just-completed sort. Built only from authored content (bucket
 * labels + counts) — never user free text — so it's injection/DPDP-safe. The
 * actual bucketing is deterministic (lib/emailsim); this is decoration with a
 * guaranteed scripted fallback.
 */
export function buildSortNarrationPrompt(
  sim: EmailSim,
  rules: EmailRule[],
  counts: Record<string, number>,
): string {
  const summary = sim.buckets
    .map((b) => `${b.label}: ${counts[b.key] ?? 0}`)
    .join(", ");
  const ruleCount = rules.length;
  return [
    "You are Rune, a witty but sharp HR-AI coach.",
    `A user just built an email sorter with ${ruleCount} rules. The sort landed as — ${summary}.`,
    "In ONE upbeat sentence (max 22 words, no emojis), congratulate them and highlight that the urgent people-critical mail rose to the top.",
  ].join(" ");
}
