import { describe, it, expect } from "vitest";
import { parseLesson, parseSim, SimScriptSchema } from "./schema";

const validLesson = {
  id: "u1-l1",
  unit: 1,
  title: "What AI actually is",
  blocks: [
    { type: "text", md: "AI is a pattern machine, not a mind." },
    { type: "callout", tone: "ai", md: "Rune: think of it as a very confident intern." },
  ],
  exercise: {
    kind: "mcq",
    prompt: "AI mostly predicts…",
    options: ["the next likely token", "the absolute truth"],
    answer: 0,
    feedback: { correct: "Exactly.", incorrect: "Close — it predicts, it doesn't *know*." },
  },
};

describe("LessonSchema", () => {
  it("accepts a well-formed lesson", () => {
    expect(() => parseLesson(validLesson)).not.toThrow();
  });
  it("rejects a lesson with an empty blocks array", () => {
    expect(() => parseLesson({ ...validLesson, blocks: [] })).toThrow();
  });
  it("rejects an unknown block type", () => {
    expect(() => parseLesson({ ...validLesson, blocks: [{ type: "video", md: "x" }] })).toThrow();
  });
});

describe("SimScriptSchema live/scripted rules (MVP §6)", () => {
  const base = {
    steps: [{ id: "s1", prompt: "Pick a system" }],
    rubric: { criteria: [{ label: "Clarity", maxScore: 5 }], improvement: "Name the inputs." },
    fallback: { output: "Payroll runs monthly…", rubricNote: "Solid first pass." },
  };

  it("accepts a system sim WITH liveGen", () => {
    expect(() =>
      parseSim({ ...base, id: "sim-system", kind: "system", liveGen: { prompt: "Explain {system}", allowFreeText: true } }),
    ).not.toThrow();
  });

  it("rejects a system sim WITHOUT liveGen", () => {
    expect(() => parseSim({ ...base, id: "sim-system", kind: "system" })).toThrow();
  });

  it("rejects an email sim that wrongly defines liveGen", () => {
    expect(() =>
      parseSim({ ...base, id: "sim-email", kind: "email", liveGen: { prompt: "x", allowFreeText: false } }),
    ).toThrow();
  });

  it("accepts an email sim as scripted rails (no liveGen)", () => {
    expect(() => parseSim({ ...base, id: "sim-email", kind: "email" })).not.toThrow();
  });

  it("defaults grillBeats to an empty array", () => {
    const parsed = SimScriptSchema.parse({ ...base, id: "sim-email", kind: "email" });
    expect(parsed.grillBeats).toEqual([]);
  });
});
