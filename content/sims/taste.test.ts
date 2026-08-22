import { describe, it, expect } from "vitest";
import { TasteSimSchema } from "@/content/schema";
import { TASTE_SIM } from "@/content/sims/taste";

describe("taste sim content", () => {
  it("parses against the TasteSim schema", () => {
    expect(() => TasteSimSchema.parse(TASTE_SIM)).not.toThrow();
  });

  it("has exactly one correct role and playful wrong options", () => {
    const correct = TASTE_SIM.role.options.filter((o) => o.correct);
    expect(correct).toHaveLength(1);
    // every wrong option teaches with a preview + nudge
    for (const o of TASTE_SIM.role.options.filter((o) => !o.correct)) {
      expect(o.preview).toBeTruthy();
      expect(o.nudge).toBeTruthy();
    }
  });

  it("can satisfy its own minSelect from real facts", () => {
    expect(TASTE_SIM.context.facts.length).toBeGreaterThanOrEqual(TASTE_SIM.context.minSelect);
  });

  it("keeps privacy distractors that never select", () => {
    expect(TASTE_SIM.context.distractors.length).toBeGreaterThan(0);
    for (const d of TASTE_SIM.context.distractors) expect(d.warning).toBeTruthy();
  });

  it("ships a non-trivial scripted fallback email", () => {
    expect(TASTE_SIM.fallbackOutput).toContain("Ananya");
    expect(TASTE_SIM.fallbackOutput.length).toBeGreaterThan(120);
  });

  it("uses no em dashes in learner-facing copy (house rule)", () => {
    const copy = [
      TASTE_SIM.intro.copy,
      TASTE_SIM.role.copy,
      TASTE_SIM.context.copy,
      TASTE_SIM.format.copy,
      TASTE_SIM.celebration.copy,
      TASTE_SIM.fallbackOutput,
      ...TASTE_SIM.grillBeat.branches.map((b) => b.retort),
    ].join(" ");
    expect(copy).not.toContain("—");
  });
});
