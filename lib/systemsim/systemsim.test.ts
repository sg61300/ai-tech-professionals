import { describe, it, expect } from "vitest";
import { SYSTEM_SIM } from "@/content/sims/system";
import { SystemSimSchema, GrillBeatSchema } from "@/content/schema";
import {
  getSample,
  hrNodes,
  incomingLabel,
  checkComprehension,
  buildRequirementsText,
  buildArtifactBody,
  deriveMermaid,
  validateGeneratedXray,
  closestPreset,
  buildSystemGrill,
} from "./index";

/** A minimal, valid generated-graph fixture (spec §4.2b contract). */
const validGen = {
  label: "Exit clearance workflow",
  nodes: [
    { id: "a", label: "Resignation submitted", kind: "start", hr: false, hint: "The clock starts." },
    { id: "b", label: "Manager approves", kind: "decision", hr: false, hint: "Coverage trade-off." },
    { id: "c", label: "HR runs clearance", kind: "hr", hr: true, hint: "HR owns the exit.", decisionBeat: "What if skipped?" },
    { id: "d", label: "Final settlement", kind: "step", hr: false, hint: "Payroll closes it out." },
  ],
  edges: [
    { from: "a", to: "b" },
    { from: "b", to: "c", label: "Approved" },
    { from: "c", to: "d" },
  ],
  edgeCases: [
    { risk: "Clearance skipped", why: "Assets and access never revoked." },
    { risk: "Settlement delayed", why: "Legal and goodwill exposure." },
  ],
  requirements: ["Track clearance steps", "Block settlement until clearance", "Audit who approved"],
  comprehension: { prompt: "Tap the HR-owned step.", correctNodeId: "c", insight: "HR owns the exit.", hint: "Where does a person decide?" },
};
const clone = () => JSON.parse(JSON.stringify(validGen));

const sim = SYSTEM_SIM;
const onboarding = sim.samples[0];

describe("SYSTEM_SIM content", () => {
  it("is schema-valid", () => {
    expect(() => SystemSimSchema.parse(sim)).not.toThrow();
  });
  it("every edge references real nodes in each sample", () => {
    for (const s of sim.samples) {
      const ids = new Set(s.nodes.map((n) => n.id));
      for (const e of s.edges) {
        expect(ids.has(e.from)).toBe(true);
        expect(ids.has(e.to)).toBe(true);
      }
    }
  });
  it("every sample has at least one HR-owned node", () => {
    for (const s of sim.samples) expect(hrNodes(s).length).toBeGreaterThan(0);
  });
});

describe("getSample", () => {
  it("finds by id and returns undefined otherwise", () => {
    expect(getSample(sim, "onboarding")?.label).toBe("HRMS onboarding flow");
    expect(getSample(sim, "nope")).toBeUndefined();
  });
});

describe("incomingLabel", () => {
  it("returns the branch label on a decision edge", () => {
    expect(incomingLabel(onboarding, "n5")).toBe("Pass");
    expect(incomingLabel(onboarding, "n6")).toBe("Fail");
    expect(incomingLabel(onboarding, "n2")).toBeUndefined();
  });
});

describe("checkComprehension", () => {
  it("passes only on the correct node", () => {
    expect(checkComprehension(onboarding, onboarding.comprehension.correctNodeId)).toBe(true);
    expect(checkComprehension(onboarding, "n1")).toBe(false);
  });
});

describe("requirements / artifact text", () => {
  it("renders bullet requirements", () => {
    const t = buildRequirementsText(onboarding);
    expect(t).toContain("requirements starter");
    expect(t).toContain("- Enforce background-check gate before role assignment");
  });
  it("artifact body bundles requirements, risks and the map", () => {
    const b = buildArtifactBody(onboarding);
    expect(b).toContain("Watch-outs:");
    expect(b).toContain("flowchart TD");
  });
});

describe("deriveMermaid", () => {
  it("emits flowchart TD with decision braces and edge labels", () => {
    const m = deriveMermaid(validGen.nodes, validGen.edges);
    expect(m.startsWith("flowchart TD")).toBe(true);
    expect(m).toContain("b{Manager approves}"); // decision node uses braces
    expect(m).toContain("a[Resignation submitted]"); // step/start uses brackets
    expect(m).toContain("b -- Approved --> c"); // labelled edge
    expect(m).toContain("a --> b"); // plain edge
  });
});

describe("validateGeneratedXray (spec §4.2b strict validation)", () => {
  it("accepts a valid graph and returns a SysSample with a derived mermaid", () => {
    const s = validateGeneratedXray(validGen);
    expect(s).not.toBeNull();
    expect(s!.nodes).toHaveLength(4);
    expect(s!.mermaid).toContain("flowchart TD");
    expect(() => SystemSimSchema.shape.samples.element.parse(s)).not.toThrow();
    expect(checkComprehension(s!, "c")).toBe(true);
  });

  it("rejects fewer than 4 nodes", () => {
    const g = clone();
    g.nodes = g.nodes.slice(0, 3);
    g.edges = [{ from: "a", to: "b" }];
    g.comprehension.correctNodeId = "c"; // still references dropped node → also invalid, fine
    expect(validateGeneratedXray(g)).toBeNull();
  });

  it("rejects more than 9 nodes", () => {
    const g = clone();
    for (let i = 0; i < 7; i++) g.nodes.push({ id: `x${i}`, label: `Step ${i}`, kind: "step", hr: false, hint: "h" });
    expect(validateGeneratedXray(g)).toBeNull();
  });

  it("rejects a dangling edge endpoint", () => {
    const g = clone();
    g.edges.push({ from: "c", to: "zzz" });
    expect(validateGeneratedXray(g)).toBeNull();
  });

  it("rejects when the comprehension node is not hr:true", () => {
    const g = clone();
    g.comprehension.correctNodeId = "a"; // a start node, hr:false
    expect(validateGeneratedXray(g)).toBeNull();
  });

  it("rejects garbage / non-objects", () => {
    expect(validateGeneratedXray(null)).toBeNull();
    expect(validateGeneratedXray("nope")).toBeNull();
    expect(validateGeneratedXray({})).toBeNull();
  });
});

describe("closestPreset", () => {
  it("keyword-matches a preset and defaults to the first sample", () => {
    expect(closestPreset(sim, "our recruitment ats screening").id).toBe("recruitment");
    expect(closestPreset(sim, "leave and time off").id).toBe("leave");
    expect(closestPreset(sim, "something totally unrelated").id).toBe(sim.samples[0].id);
  });
});

describe("buildSystemGrill (FIX 4: grill derived from THIS system's edge cases)", () => {
  it("returns a schema-valid grill with one option per edge case, worst (first) correct", () => {
    for (const s of sim.samples) {
      const grill = buildSystemGrill(s);
      expect(() => GrillBeatSchema.parse(grill)).not.toThrow();
      expect(grill.branches).toHaveLength(s.edgeCases.length);
      // exactly one correct, and it is the FIRST edge case (severity convention).
      const correctIdx = grill.branches.findIndex((b) => b.correct);
      expect(grill.branches.filter((b) => b.correct)).toHaveLength(1);
      expect(correctIdx).toBe(0);
      expect(grill.branches[0].choice).toBe(s.edgeCases[0].risk);
      expect(grill.branches[0].retort).toContain(s.edgeCases[0].why);
    }
  });

  it("does NOT reuse onboarding-specific options for the leave/recruitment systems (the bug)", () => {
    const leave = buildSystemGrill(getSample(sim, "leave")!);
    const recruitment = buildSystemGrill(getSample(sim, "recruitment")!);
    const allChoices = [...leave.branches, ...recruitment.branches].map((b) => b.choice).join(" ");
    expect(allChoices).not.toMatch(/background check/i);
    expect(allChoices).not.toMatch(/day-1|probation/i);
  });

  it("flows through for a generated (describe-your-own) graph's edge cases", () => {
    const gen = validateGeneratedXray(validGen)!;
    const grill = buildSystemGrill(gen);
    expect(() => GrillBeatSchema.parse(grill)).not.toThrow();
    expect(grill.branches[0].choice).toBe(gen.edgeCases[0].risk);
  });

  it("has a sensible fallback when a system has fewer than 2 edge cases", () => {
    const thin = { ...getSample(sim, "leave")!, edgeCases: [{ risk: "Only risk", why: "The only failure mode." }] };
    const grill = buildSystemGrill(thin);
    expect(() => GrillBeatSchema.parse(grill)).not.toThrow();
    expect(grill.branches.length).toBeGreaterThanOrEqual(2); // GrillBeat needs >=2 branches
    expect(grill.branches.filter((b) => b.correct)).toHaveLength(1);
  });
});
