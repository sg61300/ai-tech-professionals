"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SENIORITY_VALUES } from "@/lib/onboarding";

/**
 * Save edited profile details (owner-scoped). Validated server-side so a tampered
 * client can't set a locked profession/level or a bad enum. Only keys actually
 * provided are written (undefined never clobbers a column). Profession is pinned
 * to "hr" and AI proficiency to "l1" — the only unlocked choices in the MVP.
 */
const ProfileDetailsSchema = z.object({
  name: z.string().trim().max(60).optional(),
  mobile: z.string().trim().max(20).optional(),
  seniority: z.enum(SENIORITY_VALUES).optional(),
  profession: z.literal("hr").optional(),
  ai_proficiency: z.literal("l1").optional(),
});

export async function saveProfileDetails(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = ProfileDetailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid details" };

  const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  return { ok: true };
}

/** Delete one saved artifact from the user's second brain (owner-scoped). */
export async function deleteArtifact(idRaw: unknown): Promise<{ ok: boolean }> {
  const id = z.coerce.number().int().positive().safeParse(idRaw);
  if (!id.success) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  await supabase
    .from("saved_artifacts")
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id);

  revalidatePath("/profile");
  return { ok: true };
}
