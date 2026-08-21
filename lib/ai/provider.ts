/**
 * AI provider seam (IMPLEMENTATION-PLAN §6). Everything AI goes through this
 * interface so the model is swappable and every call has a scripted fallback.
 * DPDP: never log raw user text.
 */
export type AIRequest = {
  /** Fully-composed prompt (system + curated context + sanitized user input). */
  prompt: string;
  /** Optional image (data URL / base64) for multimodal sims. */
  imageBase64?: string;
  /** Soft cap on output length. */
  maxOutputTokens?: number;
};

export type AIResult = {
  text: string;
  /** 'live' = model responded; 'fallback' = scripted result was used. */
  source: "live" | "fallback";
};

export interface AIProvider {
  generate(req: AIRequest): Promise<AIResult>;
}
