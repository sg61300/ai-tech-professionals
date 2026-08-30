import type { TasteSim, EmailSim, EmailRule, InboxEmail, BiasSim } from "@/content/schema";

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

/**
 * Inbox-Tamer dynamic coaching (spec §4.1). Assembled ONLY from authored content
 * — the sim's own rubric-check labels that FAILED, and the authored from/subject
 * of the emails now at the top of the sorted inbox — never raw user text (this
 * sim has none). Asks for strict JSON: a tailored coachNote naming the learner's
 * ACTUAL gaps + a <=5-word reason per top email (AI visibly "reading" the mail).
 * Validated + golden-fallback'd by callJsonAI (schema in lib/emailsim).
 */
export function buildInboxCoachPrompt(
  _sim: EmailSim,
  failedCheckLabels: string[],
  topEmails: InboxEmail[],
): string {
  const gaps = failedCheckLabels.length
    ? failedCheckLabels.map((l) => `- ${l}`).join("\n")
    : "- (none — every good-habit check passed)";
  const top = topEmails.map((e) => `- [${e.id}] ${e.from}: ${e.subject}`).join("\n");
  return [
    "You are Rune, a sharp but encouraging HR-AI coach.",
    "A learner just built a rule-based email sorter. These good-habit checks did NOT pass:",
    gaps,
    "These emails are currently at the top of their sorted inbox:",
    top,
    'Return ONLY JSON of this exact shape: {"coachNote": string, "topReasons": [{"emailId": string, "reason": string}]}.',
    "coachNote: 2 short sentences, second person, name the specific gaps above (or praise the learner if there were none). No emojis. No em dashes.",
    "topReasons: for EACH email listed above, give a reason of at most 5 words for why it sits near the top. Use the exact emailId shown in its brackets.",
  ].join("\n");
}

/**
 * System X-Ray "describe-your-own" graph generation (spec §4.2b). This is one of
 * the two guarded free-text seams: `workflowType` is the learner's short,
 * guardInput-validated, normalized workflow TYPE (never a record) and is the ONLY
 * variable folded in. Demands the strict JSON contract validated by
 * `validateGeneratedXray` (lib/systemsim); the model returns structured
 * nodes/edges only (we derive mermaid ourselves). Any failure → closest preset.
 */
export function buildXrayGraphPrompt(workflowType: string): string {
  return [
    "You are Rune, an HR systems analyst.",
    `Map this kind of HR workflow into a data-flow graph: "${workflowType}".`,
    "Use only generic, non-confidential steps. Invent no real names, ID numbers, or company data.",
    'Return ONLY JSON of this exact shape: {"label": string, "nodes": [{"id": string, "label": string, "kind": "start"|"step"|"decision"|"hr"|"it", "hr": boolean, "hint": string, "decisionBeat"?: string}], "edges": [{"from": string, "to": string, "label"?: string}], "edgeCases": [{"risk": string, "why": string}], "requirements": [string], "comprehension": {"prompt": string, "correctNodeId": string, "insight": string, "hint": string}}.',
    "Rules: 4 to 9 nodes with short ids like n1, n2. Every edge from and to must be a node id. Mark HR-owned steps hr:true. comprehension.correctNodeId MUST be an hr:true node. 2 to 3 edgeCases. 3 to 6 requirements. Each hint is one plain-English sentence. No emojis. No em dashes.",
  ].join("\n");
}

/**
 * Bias Catcher candidate screening (spec §4.3). Assembled ONLY from authored
 * candidate data + the sim's own fix-toggle EFFECT strings (selected by the
 * learner). `jobTitle` is authored by default, or the guarded free-text title
 * (guarded on the server). Round 1 passes NO fixEffects → a deliberately naive
 * prompt that over-weights college pedigree and penalizes gaps; round 2 passes
 * the debiasing effects. Validated + golden-fallback'd by callJsonAI (permutation
 * schema in lib/biassim).
 */
export function buildScreenPrompt(
  sim: BiasSim,
  opts: { jobTitle?: string; fixEffects?: string[] } = {},
): string {
  const jobTitle = opts.jobTitle && opts.jobTitle.length > 0 ? opts.jobTitle : sim.jobTitle;
  const effects = opts.fixEffects ?? [];
  const instructions =
    effects.length > 0
      ? ["Follow these ranking instructions:", ...effects.map((e) => `- ${e}`)].join("\n")
      : "Rank strongly by college prestige, and be cautious about anyone with an employment gap.";
  const candidates = sim.candidates
    .map(
      (c) =>
        `- [${c.id}] ${c.name}, ${c.role}. Strength: ${c.merit}. College: ${c.college}. Employment gap: ${c.hasGap ? "yes" : "no"}.`,
    )
    .join("\n");
  return [
    "You are an AI resume screener.",
    `Rank these ${sim.candidates.length} candidates for the role of "${jobTitle}", best first.`,
    instructions,
    "Candidates:",
    candidates,
    'Return ONLY JSON of this exact shape: {"ranking": [{"rank": number, "candidateId": string, "reason": string}]}.',
    "Rank every candidate exactly once using the candidateId shown in its brackets. Each reason is at most 12 words. No emojis. No em dashes.",
  ].join("\n");
}
