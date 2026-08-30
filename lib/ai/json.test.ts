import { describe, it, expect } from "vitest";
import { z } from "zod";
import { extractJson, callJsonAI } from "./json";
import type { AIProvider } from "./provider";

/**
 * `callJsonAI` is the ONE JSON seam for every structured AI feature (Inbox
 * coach, X-Ray graph, Bias ranking). It layers JSON extraction + Zod validation
 * on top of `callAI` (whose fallback is a string only), returning the caller's
 * typed `golden` object on ANY failure — fallback, garbage, or invalid shape.
 */

const Schema = z.object({ note: z.string() });
const golden = { note: "scripted" };

const provider = (text: string): AIProvider => ({
  generate: async () => ({ text, source: "live" }),
});
const boom: AIProvider = {
  generate: async () => {
    throw new Error("429 quota");
  },
};

describe("extractJson", () => {
  it("parses a bare JSON object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("strips ```json fences", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("finds the object inside surrounding prose", () => {
    expect(extractJson('Sure! Here you go: {"a":1} Hope that helps')).toEqual({ a: 1 });
  });
  it("returns null on garbage / truncation", () => {
    expect(extractJson("not json at all")).toBeNull();
    expect(extractJson('{"a":1')).toBeNull();
    expect(extractJson("")).toBeNull();
  });
});

describe("callJsonAI", () => {
  it("returns parsed, validated data on a live valid response", async () => {
    const r = await callJsonAI({
      req: { prompt: "x" },
      golden,
      schema: Schema,
      provider: provider('{"note":"live"}'),
    });
    expect(r).toEqual({ data: { note: "live" }, source: "live" });
  });

  it("falls back to golden on a live but unparseable response", async () => {
    const r = await callJsonAI({
      req: { prompt: "x" },
      golden,
      schema: Schema,
      provider: provider("total nonsense, no json"),
    });
    expect(r).toEqual({ data: golden, source: "fallback" });
  });

  it("falls back to golden when the JSON fails schema validation", async () => {
    const r = await callJsonAI({
      req: { prompt: "x" },
      golden,
      schema: Schema,
      provider: provider('{"wrong":"shape"}'),
    });
    expect(r).toEqual({ data: golden, source: "fallback" });
  });

  it("falls back to golden on provider error (never throws)", async () => {
    const r = await callJsonAI({ req: { prompt: "x" }, golden, schema: Schema, provider: boom });
    expect(r).toEqual({ data: golden, source: "fallback" });
  });

  it("parses a markdown-fenced live response", async () => {
    const r = await callJsonAI({
      req: { prompt: "x" },
      golden,
      schema: Schema,
      provider: provider('```json\n{"note":"fenced"}\n```'),
    });
    expect(r).toEqual({ data: { note: "fenced" }, source: "live" });
  });
});
