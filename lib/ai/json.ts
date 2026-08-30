import "server-only";
import type { ZodType } from "zod";
import { callAI } from "./index";
import type { AIRequest, AIProvider } from "./provider";

/**
 * `callJsonAI` — the JSON seam on top of `callAI`.
 *
 * `callAI` guarantees a STRING fallback and never throws, but the dynamic sims
 * return JSON. This helper adds: (1) markdown-fence-tolerant JSON extraction,
 * (2) Zod validation against the caller's contract, and (3) a typed `golden`
 * fallback used on ANY failure (quota/timeout/error → fallback, or a live
 * response that won't parse / won't validate). One well-tested primitive for the
 * Inbox coach, the X-Ray graph, and the Bias ranking. DPDP: never logs text.
 */

/** Extract a JSON object from model text (strips ```json fences + surrounding prose). Returns null on failure. */
export function extractJson(text: string): unknown {
  const unfenced = text.replace(/```(?:json)?/gi, "").trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    return null;
  }
}

export type JsonAIResult<T> = { data: T; source: "live" | "fallback" };

/**
 * Run one bounded JSON call. `golden` is returned (as a fallback) whenever the
 * live path can't produce a schema-valid object, so callers always get a usable,
 * typed value and can render the honest "⚡ sample" tag on `source === "fallback"`.
 */
export async function callJsonAI<T>(opts: {
  req: AIRequest;
  golden: T;
  schema: ZodType<T>;
  provider?: AIProvider;
}): Promise<JsonAIResult<T>> {
  const { req, golden, schema, provider } = opts;
  // Empty string fallback: we detect `source` ourselves and swap in `golden`.
  const { text, source } = provider ? await callAI(req, "", provider) : await callAI(req, "");
  if (source === "fallback") return { data: golden, source: "fallback" };

  const raw = extractJson(text);
  const parsed = raw === null ? null : schema.safeParse(raw);
  if (!parsed || !parsed.success) return { data: golden, source: "fallback" };

  return { data: parsed.data, source: "live" };
}
