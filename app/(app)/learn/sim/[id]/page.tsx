import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSim, getEmailSim, getSystemSim, L1_SPINE } from "@/content";
import { isUnlocked } from "@/lib/progression";
import { TasteSimRunner } from "@/components/sim/TasteSimRunner";
import { EmailSimRunner } from "@/components/sim/EmailSimRunner";
import { SystemSimRunner } from "@/components/sim/SystemSimRunner";

/**
 * Sim route. Server-gates like the lesson route: signed in, onboarded, and the
 * sim must be unlocked (taste needs L1+L2; the email sim needs Lessons 1–5 +
 * RF1). Dispatches by sim kind — taste vs the "Inbox Tamer" full sim.
 */
export default async function SimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const taste = getSim(id);
  const email = getEmailSim(id);
  const system = getSystemSim(id);
  if (!taste && !email && !system) redirect("/learn");

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

  if (system) return <SystemSimRunner sim={system} />;
  if (email) return <EmailSimRunner sim={email} />;
  return <TasteSimRunner sim={taste!} />;
}
