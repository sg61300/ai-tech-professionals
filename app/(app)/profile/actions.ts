"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
