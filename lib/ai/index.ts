import "server-only";
import type { AIProvider, AIRequest, AIResult } from "./provider";
import { GeminiProvider } from "./gemini";

export type { AIProvider, AIRequest, AIResult } from "./provider";

const TIMEOUT_MS = 8000;

/** Lazily construct the default provider so a missing key only fails at call time. */
let _provider: AIProvider | null = null;
function defaultProvider(): AIProvider {
  if (!_provider) _provider = new GeminiProvider();
  return _provider;
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("ai-timeout")), ms),
  );
}

/**
 * The ONE entry point for every AI call (plan §6). Races the live provider
 * against an 8s timeout; on ANY error / timeout / quota it resolves with the
 * caller's scripted `fallback` text and `source: 'fallback'`. Always resolves,
 * so no AI feature can dead-end the activation funnel.
 *
 * "Rune is Tuning" (RuneLoader) should be shown by the caller while this is
 * in flight, and swapped to the fallback UI when `source === 'fallback'`.
 */
export async function callAI(
  req: AIRequest,
  fallback: string,
  provider: AIProvider = defaultProvider(),
): Promise<AIResult> {
  try {
    return await Promise.race([provider.generate(req), timeout(TIMEOUT_MS)]);
  } catch {
    // Intentionally swallow (incl. the raw error, which could echo user text — DPDP).
    return { text: fallback, source: "fallback" };
  }
}
