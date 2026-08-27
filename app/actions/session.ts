"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { civilDateInTz } from "@/lib/streak";
import { captureServer } from "@/lib/analytics/server";
import { EVENTS } from "@/lib/analytics/events";
import { applyReferralCode } from "@/app/actions/referral";
import { normalizeCode } from "@/lib/referral";

/**
 * Fires the session-level funnel events (Architecture/05). Called once per
 * browser session by <SessionTracker/>. Uses profiles.last_seen_date (civil) so
 * each event lands at most once per calendar day:
 *  - session_start          — every new session
 *  - signed_up              — the user's first-ever session (last_seen_date null)
 *  - returned_separate_day  — a session on a NEW calendar day after signup day
 *                             (north-star part 2)
 * No-ops for signed-out visitors and when the PostHog key is unset.
 */
export async function recordSession(
  /** Resolved theme at session start — $set as `preferred_theme` so users who
   *  never toggle are still counted for metric #10 (Architecture/12). */
  theme?: "dark" | "light",
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("last_seen_date, created_at, timezone")
    .eq("id", user.id)
    .single();
  if (!profile) return;

  const tz = profile.timezone ?? "Asia/Kolkata";
  const today = civilDateInTz(new Date(), tz);
  const lastSeen = (profile.last_seen_date as string | null) ?? null;

  await captureServer(
    user.id,
    EVENTS.SESSION_START,
    {},
    theme ? { preferred_theme: theme } : undefined,
  );

  if (lastSeen === null) {
    // First authenticated session ≈ signup complete (funnel entry point).
    // Resolve any first-touch referral cookie so `signed_up` carries the
    // referred-vs-organic split (weekly referred-signup rate, ADR-020).
    let viaReferral = false;
    let referralCode: string | null = null;
    const jar = await cookies();
    const raw = jar.get("rune_ref")?.value ?? null;
    if (raw) {
      const applied = await applyReferralCode(raw, "signup");
      if (applied.ok) {
        viaReferral = true;
        referralCode = normalizeCode(raw);
      }
      jar.delete("rune_ref"); // consumed — don't reprocess
    }
    await captureServer(
      user.id,
      EVENTS.SIGNED_UP,
      viaReferral ? { via_referral: true, referral_code: referralCode } : { via_referral: false },
    );
  } else if (lastSeen !== today) {
    const signupDay = civilDateInTz(new Date(profile.created_at), tz);
    if (today !== signupDay) {
      await captureServer(user.id, EVENTS.RETURNED_SEPARATE_DAY, {});
    }
  }

  if (lastSeen !== today) {
    await supabase.from("profiles").update({ last_seen_date: today }).eq("id", user.id);
  }
}
