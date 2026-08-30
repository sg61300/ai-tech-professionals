import { describe, it, expect } from "vitest";
import { tasteSim, emailSim } from "@/content";
import { BIAS_SIM } from "@/content/sims/bias";
import {
  buildTastePrompt,
  buildInboxCoachPrompt,
  buildXrayGraphPrompt,
  buildScreenPrompt,
} from "@/lib/ai/prompts";

const correctRole = tasteSim.role.options.findIndex((o) => o.correct);

describe("buildTastePrompt", () => {
  it("assembles role, context, task and format from curated selections", () => {
    const p = buildTastePrompt(tasteSim, {
      roleIndex: correctRole,
      factIndices: [0, 1, 2],
      toggleIndices: [0, 1],
    });
    expect(p).toContain(tasteSim.role.options[correctRole].value);
    expect(p).toContain(tasteSim.context.facts[0].value);
    expect(p).toContain(tasteSim.context.facts[2].value);
    expect(p).toContain(tasteSim.assembled.task);
    expect(p).toContain(tasteSim.format.toggles[0].value);
    // no unreplaced template holes
    expect(p).not.toMatch(/\{(role|context|task|format)\}/);
  });

  it("ignores out-of-range indices instead of crashing (tamper-safe)", () => {
    const p = buildTastePrompt(tasteSim, {
      roleIndex: 999,
      factIndices: [0, 42, -1],
      toggleIndices: [7],
    });
    // still a usable prompt; only the valid fact survives, role empty
    expect(typeof p).toBe("string");
    expect(p).toContain(tasteSim.context.facts[0].value);
    expect(p).not.toContain("undefined");
  });
});

describe("buildInboxCoachPrompt", () => {
  const top = emailSim.inbox.slice(0, 3);
  const failedLabel = emailSim.rubric.checks[0].label;

  it("assembles only authored content: failed check labels + top email from/subject", () => {
    const p = buildInboxCoachPrompt(emailSim, [failedLabel], top);
    expect(p).toContain(failedLabel);
    for (const e of top) {
      expect(p).toContain(e.id);
      expect(p).toContain(e.subject);
    }
  });

  it("requests the strict JSON coach shape", () => {
    const p = buildInboxCoachPrompt(emailSim, [failedLabel], top);
    expect(p).toContain("coachNote");
    expect(p).toContain("topReasons");
    expect(p).toContain("emailId");
  });

  it("handles the all-clear case with no failed checks", () => {
    const p = buildInboxCoachPrompt(emailSim, [], top);
    expect(typeof p).toBe("string");
    expect(p).not.toContain("undefined");
  });
});

describe("buildXrayGraphPrompt", () => {
  it("folds in the guarded workflow type and demands the strict JSON contract", () => {
    const p = buildXrayGraphPrompt("employee offboarding");
    expect(p).toContain("employee offboarding");
    expect(p).toContain('"nodes"');
    expect(p).toContain('"edges"');
    expect(p).toContain("comprehension");
    expect(p).toContain("hr:true"); // the HR-comprehension rule
    expect(p).toContain("4 to 9 nodes");
  });

  it("instructs against confidential data and emojis/em-dashes", () => {
    const p = buildXrayGraphPrompt("recruitment");
    expect(p).toContain("non-confidential");
    expect(p).toContain("No emojis");
  });
});

describe("buildScreenPrompt", () => {
  it("round 1 uses the naive, bias-prone instruction and lists every candidate id", () => {
    const p = buildScreenPrompt(BIAS_SIM);
    expect(p).toContain("college prestige");
    expect(p).toContain("employment gap");
    for (const c of BIAS_SIM.candidates) expect(p).toContain(`[${c.id}]`);
    expect(p).toContain('"ranking"');
    expect(p).toContain(BIAS_SIM.jobTitle);
  });

  it("round 2 folds in the selected debiasing effects and drops the naive line", () => {
    const effects = BIAS_SIM.fixToggles.filter((t) => t.debiasing).map((t) => t.effect);
    const p = buildScreenPrompt(BIAS_SIM, { fixEffects: effects });
    for (const e of effects) expect(p).toContain(e);
    expect(p).not.toContain("Rank strongly by college prestige");
  });

  it("uses a provided (guarded) job title when given", () => {
    const p = buildScreenPrompt(BIAS_SIM, { jobTitle: "Payroll Analyst" });
    expect(p).toContain("Payroll Analyst");
  });
});
