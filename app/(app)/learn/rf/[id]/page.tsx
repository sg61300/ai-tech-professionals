import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRapidFire, L1_SPINE } from "@/content";
import { isUnlocked } from "@/lib/progression";
import { RapidFireRunner } from "@/components/rapidfire/RapidFireRunner";

/**
 * Rapid-fire route. Server-gates like the lesson/sim routes: signed in,
 * onboarded, and the round must be unlocked (RF1 needs Lessons 1–5 done).
 */
export default async function RapidFirePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const set = getRapidFire(id);
  if (!set) redirect("/learn");

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

  return <RapidFireRunner set={set} />;
}
