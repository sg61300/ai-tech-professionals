import type { SystemSim, SysSample, SysNode } from "@/content/schema";

/**
 * System X-Ray engine (PRD/10). Pure helpers over the typed system graph:
 * finding HR-owned steps, checking the light comprehension tap, and compiling
 * the requirements starter / artifact text. No IO; TDD'd and shared by the
 * runner + the completion action.
 */

export const getSample = (sim: SystemSim, id: string): SysSample | undefined =>
  sim.samples.find((s) => s.id === id);

/** Nodes HR owns (glow + "HR owns this" badge). */
export const hrNodes = (sample: SysSample): SysNode[] => sample.nodes.filter((n) => n.hr);

/** The label on the edge leading INTO a node (e.g. "Pass"/"Fail"), if any. */
export function incomingLabel(sample: SysSample, nodeId: string): string | undefined {
  return sample.edges.find((e) => e.to === nodeId && e.label)?.label;
}

/** Light comprehension check (not a rubric): did they tap the right step? */
export function checkComprehension(sample: SysSample, nodeId: string): boolean {
  return nodeId === sample.comprehension.correctNodeId;
}

/** The copy-able requirements starter (also the saved artifact body). */
export function buildRequirementsText(sample: SysSample): string {
  const lines = sample.requirements.map((r) => `- ${r}`).join("\n");
  return `${sample.label} — requirements starter (draft):\n${lines}`;
}

/** Full saved-artifact body: requirements + edge cases + the mermaid map. */
export function buildArtifactBody(sample: SysSample): string {
  const risks = sample.edgeCases.map((e) => `- ${e.risk}: ${e.why}`).join("\n");
  return [
    buildRequirementsText(sample),
    "",
    "Watch-outs:",
    risks,
    "",
    "Map:",
    sample.mermaid,
  ].join("\n");
}
