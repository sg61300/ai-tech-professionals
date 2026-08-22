"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics/server";
import { EVENTS } from "@/lib/analytics/events";
import { callAI } from "@/lib/ai";
import { buildTastePrompt } from "@/lib/ai/prompts";
import { tasteSim } from "@/content";

const SelectionsSchema = z.object({
  roleIndex: z.number().int(),
  factIndices: z.array(z.number().int()).max(20),
  toggleIndices: z.array(z.number().int()).max(20),
});

export type TasteGenResult =
  | { ok: true; text: string; source: "live" | "fallback" }
  | { ok: false; error: string };

/**
 * Generate the taste-sim email. The prompt is assembled server-side from the
 * user's curated selections (indices only — never free text), then run through
 * `callAI`, which guarantees a scripted fallback on error/timeout/quota so the
 * sim never dead-ends. Auth-gated because it spends Gemini quota.
 */
export async function generateTasteEmail(input: unknown): Promise<TasteGenResult> {
  const parsed = SelectionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid selections" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const prompt = buildTastePrompt(tasteSim, parsed.data);
  const { text, source } = await callAI({ prompt, maxOutputTokens: 450 }, tasteSim.fallbackOutput);

  // Watch the fallback rate on free-tier quota (plan §6). Never log the prompt/text (DPDP).
  if (source === "fallback") {
    await captureServer(user.id, EVENTS.AI_FALLBACK_USED, { surface: "taste_sim" });
  }

  return { ok: true, text, source };
}
