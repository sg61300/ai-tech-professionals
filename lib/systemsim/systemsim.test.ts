import { describe, it, expect } from "vitest";
import { SYSTEM_SIM } from "@/content/sims/system";
import { SystemSimSchema } from "@/content/schema";
import {
  getSample,
  hrNodes,
  incomingLabel,
  checkComprehension,
  buildRequirementsText,
  buildArtifactBody,
} from "./index";

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
