"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics/server";
import { EVENTS } from "@/lib/analytics/events";
import { OnboardingPatchSchema, type OnboardingPatch } from "@/lib/onboarding";

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Persist one onboarding step's fields to the signed-in user's profile.
 * Called after each step (incremental save = free resume, PRD/13). Validated
 * server-side so a tampered client can't set a locked profession or bad enum.
 */
export async function saveOnboarding(input: OnboardingPatch): Promise<SaveResult> {
  const parsed = OnboardingPatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid onboarding input" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Only send keys the client actually provided (undefined would clobber columns).
  const patch = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  if (parsed.data.onboarding_complete) {
    await captureServer(user.id, EVENTS.ONBOARDING_COMPLETE, {
      profession: parsed.data.profession ?? "hr",
      seniority: parsed.data.seniority ?? "",
      ai_comfort: parsed.data.ai_proficiency ?? "",
    });
    revalidatePath("/learn");
  }
  return { ok: true };
}
