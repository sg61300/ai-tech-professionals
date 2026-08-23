"use server";

import { createClient } from "@/lib/supabase/server";
import { civilDateInTz } from "@/lib/streak";
import { captureServer } from "@/lib/analytics/server";
import { EVENTS } from "@/lib/analytics/events";

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
export async function recordSession(): Promise<void> {
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

  await captureServer(user.id, EVENTS.SESSION_START, {});

  if (lastSeen === null) {
    // First authenticated session ≈ signup complete (funnel entry point).
    await captureServer(user.id, EVENTS.SIGNED_UP, {});
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
