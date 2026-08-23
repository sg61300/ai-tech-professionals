import { describe, it, expect } from "vitest";
import { RapidFireSetSchema } from "@/content/schema";
import { RF1 } from "./rf1";

describe("RF1 content", () => {
  it("is a valid rapid-fire set", () => {
    expect(() => RapidFireSetSchema.parse(RF1)).not.toThrow();
  });
  it("has 8 questions with in-range correct indices", () => {
    expect(RF1.items).toHaveLength(8);
    for (const q of RF1.items) {
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(q.options.length);
      expect(q.teach.length).toBeGreaterThan(0);
    }
  });
  it("unique question ids", () => {
    const ids = RF1.items.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("unlocks the email sim on pass", () => {
    expect(RF1.unlocksSimId).toBe("sim-email");
    expect(RF1.passThreshold).toBe(6);
  });
});
