import { describe, it, expect, vi } from "vitest";
import { callAI } from "./index";
import type { AIProvider } from "./provider";

const ok: AIProvider = {
  generate: async () => ({ text: "live answer", source: "live" }),
};
const boom: AIProvider = {
  generate: async () => {
    throw new Error("429 quota");
  },
};
const slow: AIProvider = {
  generate: () => new Promise((r) => setTimeout(() => r({ text: "late", source: "live" }), 20_000)),
};

describe("callAI", () => {
  it("returns the live result when the provider succeeds", async () => {
    const r = await callAI({ prompt: "x" }, "SCRIPTED", ok);
    expect(r).toEqual({ text: "live answer", source: "live" });
  });

  it("falls back on provider error (never throws)", async () => {
    const r = await callAI({ prompt: "x" }, "SCRIPTED", boom);
    expect(r).toEqual({ text: "SCRIPTED", source: "fallback" });
  });

  it("falls back when the provider exceeds the 8s timeout", async () => {
    vi.useFakeTimers();
    const p = callAI({ prompt: "x" }, "SCRIPTED", slow);
    await vi.advanceTimersByTimeAsync(8001);
    const r = await p;
    expect(r).toEqual({ text: "SCRIPTED", source: "fallback" });
    vi.useRealTimers();
  });
});
