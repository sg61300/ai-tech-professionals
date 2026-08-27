"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type VerifyOtpResult = { error: string };

/**
 * Verify the 6-digit email OTP SERVER-SIDE and route the user in.
 *
 * Why a server action (not client verifyOtp + window.location.assign):
 *  - verifyOtp here writes the session cookie onto the action response, so the
 *    session is live server-side atomically — no cookie race that used to need a
 *    second click.
 *  - redirect() is a single SOFT navigation to the destination. The old hard
 *    window.location.assign rebooted the whole app: the login loader vanished,
 *    the page went blank, then the route loader appeared — read as "loading
 *    twice". A soft redirect hands the login loader straight to the destination's
 *    loading.tsx (same RuneLoader) with no reload flash = one continuous loader.
 *
 * Routes straight to the correct screen so /learn can't bounce a brand-new user
 * to /onboarding (that bounce was itself a second navigation / second loader).
 * Returns only on FAILURE; success throws the redirect.
 */
export async function verifyOtpAction(
  email: string,
  token: string,
): Promise<VerifyOtpResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: "email",
  });
  if (error) return { error: error.message };

  // Default to /onboarding when the profile isn't readable yet (a brand-new
  // signup) — /learn would only redirect there anyway.
  let dest = "/onboarding";
  const uid = data.user?.id;
  if (uid) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("id", uid)
      .single();
    if (prof?.onboarding_complete) dest = "/learn";
  }

  redirect(dest); // single soft navigation; throws NEXT_REDIRECT (never returns)
}
