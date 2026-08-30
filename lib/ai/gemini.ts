import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProvider, AIRequest, AIResult } from "./provider";

/**
 * Gemini Flash implementation of AIProvider. Server-only (key never reaches the
 * client). Throws on error/quota — the `callAI` wrapper turns any throw or the
 * 8s timeout into the scripted fallback so the funnel never dead-ends.
 */
// Auto-updating alias (overridable via env) so a model deprecation is a config
// change, not a silent fallback. Google retired the pinned `gemini-2.0-flash`,
// which made `callAI` swallow a 404 and serve the scripted fallback every time
// — the live generation looked "identical every run" instead of erroring.
// `-lite` is non-thinking (full output within the token budget) and lightest on
// free-tier quota, which suits this short-email task.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";

export class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;

  constructor(apiKey = process.env.GEMINI_API_KEY) {
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generate(req: AIRequest): Promise<AIResult> {
    const model = this.client.getGenerativeModel({
      model: MODEL,
      generationConfig: { maxOutputTokens: req.maxOutputTokens ?? 800 },
    });

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
      { text: req.prompt },
    ];
    if (req.imageBase64) {
      parts.push({ inlineData: { data: req.imageBase64, mimeType: "image/png" } });
    }

    const result = await model.generateContent(parts);
    const text = result.response.text().trim();
    if (!text) throw new Error("Empty response from Gemini");
    return { text, source: "live" };
  }
}
