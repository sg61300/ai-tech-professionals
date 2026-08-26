import { describe, it, expect } from "vitest";
import { RapidFireSetSchema } from "@/content/schema";
import { RF2 } from "./rf2";

describe("RF2 content", () => {
  it("is a valid rapid-fire set", () => {
    expect(() => RapidFireSetSchema.parse(RF2)).not.toThrow();
  });
  it("has 8 questions with in-range correct indices and a teach line", () => {
    expect(RF2.items).toHaveLength(8);
    for (const q of RF2.items) {
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(q.options.length);
      expect(q.teach.length).toBeGreaterThan(0);
    }
  });
  it("unique question ids", () => {
    const ids = RF2.items.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("unlocks the system sim on pass", () => {
    expect(RF2.unlocksSimId).toBe("sim-system");
    expect(RF2.passThreshold).toBe(5); // >50% of 8
  });
});
