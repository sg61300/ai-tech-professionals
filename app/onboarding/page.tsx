import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { firstUnfinishedStep, type OnboardingProfile } from "@/lib/onboarding";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

/**
 * Onboarding gate (PRD/13 routing). Loads the profile, and:
 *   - already complete  -> straight to /learn (returning users never see cards)
 *   - otherwise         -> render the flow at the first unfinished step (resume)
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("profession, name, avatar_name, mobile, avatar_key, seniority, ai_proficiency, onboarding_complete")
    .eq("id", user.id)
    .single();

  const profile: OnboardingProfile = {
    profession: data?.profession ?? null,
    name: data?.name ?? null,
    avatar_key: data?.avatar_key ?? null,
    seniority: data?.seniority ?? null,
    ai_proficiency: data?.ai_proficiency ?? null,
    onboarding_complete: data?.onboarding_complete ?? false,
  };

  const step = firstUnfinishedStep(profile);
  if (step === null) redirect("/learn");

  return (
    <OnboardingFlow
      startStep={step}
      initial={{
        name: data?.name ?? "",
        avatarName: data?.avatar_name ?? "",
        mobile: data?.mobile ?? "",
        avatarKey: data?.avatar_key ?? null,
        seniority: data?.seniority ?? null,
        aiComfort: data?.ai_proficiency ?? null,
      }}
    />
  );
}
