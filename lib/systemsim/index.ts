import { GeneratedXraySchema, SystemSimSchema } from "@/content/schema";
import type { SystemSim, SysSample, SysNode, SysEdge, GrillBeat } from "@/content/schema";

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
  return `${sample.label} requirements starter (draft):\n${lines}`;
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

// --- Describe-your-own X-Ray (spec §4.2b) -----------------------------------
// The model returns structured nodes/edges only; we DERIVE the mermaid string
// deterministically (ruling #5) and validate the whole graph hard. On any
// failure the action swaps in the closest preset, labelled a sample.

/** Strip mermaid-breaking characters from a label. */
const escLabel = (s: string): string => s.replace(/[[\]{}"|<>]/g, "").trim();

/** Deterministically derive a `flowchart TD` mermaid string from nodes/edges. */
export function deriveMermaid(nodes: { id: string; label: string; kind: string }[], edges: SysEdge[]): string {
  const nodeLines = nodes.map((n) =>
    n.kind === "decision" ? `  ${n.id}{${escLabel(n.label)}}` : `  ${n.id}[${escLabel(n.label)}]`,
  );
  const edgeLines = edges.map((e) =>
    e.label ? `  ${e.from} -- ${escLabel(e.label)} --> ${e.to}` : `  ${e.from} --> ${e.to}`,
  );
  return ["flowchart TD", ...nodeLines, ...edgeLines].join("\n");
}

/**
 * Validate a generated graph against the strict §4.2b contract, then assemble a
 * full `SysSample` (with a derived mermaid) so the EXISTING preset render path +
 * artifact/completion path work unchanged. Returns null on any parse/refine
 * failure, so the caller falls back to the closest preset.
 */
export function validateGeneratedXray(json: unknown): SysSample | null {
  const parsed = GeneratedXraySchema.safeParse(json);
  if (!parsed.success) return null;
  const g = parsed.data;
  const candidate = {
    id: "generated",
    label: g.label,
    nodes: g.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      kind: n.kind,
      hint: n.hint,
      hr: n.hr,
      ...(n.decisionBeat ? { decisionBeat: n.decisionBeat } : {}),
    })),
    edges: g.edges,
    edgeCases: g.edgeCases,
    requirements: g.requirements,
    comprehension: g.comprehension,
    mermaid: deriveMermaid(g.nodes, g.edges),
  };
  // Belt-and-suspenders: the assembled object must also satisfy the preset schema.
  const reparsed = SystemSimSchema.shape.samples.element.safeParse(candidate);
  return reparsed.success ? reparsed.data : null;
}

/** Pick the closest preset to a workflow-type phrase (keyword match; defaults to the first). */
export function closestPreset(sim: SystemSim, workflowType: string): SysSample {
  const q = workflowType.toLowerCase();
  const hit = sim.samples.find((s) => {
    const key = `${s.id} ${s.label}`.toLowerCase();
    return key.split(/[^a-z]+/).some((w) => w.length > 3 && q.includes(w));
  });
  return hit ?? sim.samples[0];
}

/**
 * Derive the end-of-sim grill from THIS system's own edge cases (FIX 4). The old
 * static SystemSim.grillBeat named onboarding-specific steps and showed for every
 * system (leave, recruitment, describe-your-own) where those options were
 * nonsense. Convention: a system's FIRST edge case is the most severe, so it is
 * the correct answer; each option's `why` is its retort. Describe-your-own's
 * AI-generated edge cases flow through the same path. Falls back to a safe 2-option
 * grill if a system somehow has fewer than 2 edge cases (GrillBeat needs >=2).
 */
export function buildSystemGrill(sample: SysSample): GrillBeat {
  const prompt = "Which single failure would cause the most damage?";
  const cases = sample.edgeCases;

  if (cases.length >= 2) {
    const worst = cases[0].risk;
    return {
      prompt,
      branches: cases.map((e, i) => ({
        choice: e.risk,
        retort:
          i === 0
            ? e.why
            : `${e.why} Real, but recoverable. The costliest, least-reversible failure here is "${worst}".`,
        correct: i === 0,
      })),
    };
  }

  // Fallback: fewer than 2 edge cases. Keep the worst (if any) as the correct
  // answer and add a generic low-stakes distractor so the grill still teaches.
  const only = cases[0];
  return {
    prompt,
    branches: [
      {
        choice: only ? only.risk : "A skipped compliance or system-of-record step",
        retort: only ? only.why : "The least reversible failure is the costliest, so protect it first.",
        correct: true,
      },
      {
        choice: "A minor cosmetic or formatting step",
        retort: "Cosmetic issues are recoverable. The costly failures are the ones you cannot easily undo.",
        correct: false,
      },
    ],
  };
}
