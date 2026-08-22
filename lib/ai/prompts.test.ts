import { describe, it, expect } from "vitest";
import { tasteSim } from "@/content";
import { buildTastePrompt } from "@/lib/ai/prompts";

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
