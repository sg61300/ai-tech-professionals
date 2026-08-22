import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSim, L1_SPINE } from "@/content";
import { isUnlocked } from "@/lib/progression";
import { TasteSimRunner } from "@/components/sim/TasteSimRunner";

/**
 * Sim route. Server-gates like the lesson route: signed in, onboarded, and the
 * sim must be unlocked (taste sim needs L1+L2 done). Only the taste sim exists
 * in MVP; other sim kinds land in later slices.
 */
export default async function SimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sim = getSim(id);
  if (!sim) redirect("/learn");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete")
    .eq("id", user.id)
    .single();
  if (!profile?.onboarding_complete) redirect("/onboarding");

  const { data: rows } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", user.id)
    .eq("status", "done");
  const completed = new Set((rows ?? []).map((r) => r.lesson_id));

  const node = L1_SPINE.find((n) => n.id === id);
  if (node && !isUnlocked(node, completed)) redirect("/learn");

  return <TasteSimRunner sim={sim} />;
}
