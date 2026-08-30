import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSim, getEmailSim, getSystemSim, getBiasSim, L1_SPINE } from "@/content";
import { isUnlocked } from "@/lib/progression";
import { TasteSimRunner } from "@/components/sim/TasteSimRunner";
import { EmailSimRunner } from "@/components/sim/EmailSimRunner";
import { SystemSimRunner } from "@/components/sim/SystemSimRunner";
import { BiasSimRunner } from "@/components/sim/BiasSimRunner";
import { SimOpenTracker } from "@/components/sims/SimOpenTracker";

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
  const bias = getBiasSim(id);
  if (!taste && !email && !system && !bias) redirect("/learn");

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
  const { data: unlockRow } = await supabase
    .from("sim_unlocks")
    .select("id")
    .eq("user_id", user.id)
    .eq("sim_id", id)
    .maybeSingle();
  const xpUnlocked = !!unlockRow;
  if (node && !isUnlocked(node, completed) && !xpUnlocked) redirect("/learn");
  const pathUnlocked = node ? isUnlocked(node, completed) : true;
  const via: "path" | "xp" = !pathUnlocked && xpUnlocked ? "xp" : "path";

  if (bias)
    return (
      <>
        <SimOpenTracker simId={id} via={via} />
        <BiasSimRunner sim={bias} />
      </>
    );
  if (system)
    return (
      <>
        <SimOpenTracker simId={id} via={via} />
        <SystemSimRunner sim={system} />
      </>
    );
  if (email)
    return (
      <>
        <SimOpenTracker simId={id} via={via} />
        <EmailSimRunner sim={email} />
      </>
    );
  return (
    <>
      <SimOpenTracker simId={id} via={via} />
      <TasteSimRunner sim={taste!} />
    </>
  );
}
