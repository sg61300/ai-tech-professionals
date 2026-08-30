"use server";

import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/analytics/server";
import { EVENTS } from "@/lib/analytics/events";

/**
 * Thin, authed telemetry actions for the engagement/demand metrics
 * (Architecture/12 v2). Fired from client components as fire-and-forget
 * (`void trackX()`). Each no-ops for signed-out visitors and when the PostHog
 * key is unset — mirrors app/actions/session.ts.
 *
 * These MUST be server-side: the whole funnel is keyed on the Supabase user.id
 * distinct-id and there is no client-side identify(), so firing via posthog-js
 * would land under a different distinct-id and break every funnel join.
 */

async function userId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Metric #4 — Articles demand (tab tapped, even though the page is "Coming soon"). */
export async function trackArticlesOpened(): Promise<void> {
  const id = await userId();
  if (!id) return;
  await captureServer(id, EVENTS.ARTICLES_TAB_OPENED, {});
}

/** Metric #8 — L2/L3 curiosity. surface = where the tap happened. */
export async function trackLockedLevelTapped(
  level: "l2" | "l3",
  surface: "onboarding" | "profile" | "path",
): Promise<void> {
  const id = await userId();
  if (!id) return;
  await captureServer(id, EVENTS.LOCKED_LEVEL_TAPPED, { level, surface });
}

/**
 * Metric #9a — interest in another domain: the user tapped a locked (non-HR)
 * profession. `profession` = which domain they want; the demand signal.
 */
export async function trackProfessionInterest(
  profession: string,
  surface: "onboarding" | "profile",
): Promise<void> {
  const id = await userId();
  if (!id) return;
  await captureServer(id, EVENTS.PROFESSION_INTEREST, { profession, surface });
}

/**
 * Metric #9b — the user SAVED a different seniority (fires only on a committed
 * change to a new value, from EditableDetails.doSave). Not the picker-open.
 */
export async function trackProfileEditSaved(field: "seniority"): Promise<void> {
  const id = await userId();
  if (!id) return;
  await captureServer(id, EVENTS.PROFILE_EDIT_SAVED, { field });
}

/** Metric #10 — dark-mode preference. Sets the `preferred_theme` person property too. */
export async function trackThemePreference(theme: "dark" | "light"): Promise<void> {
  const id = await userId();
  if (!id) return;
  await captureServer(id, EVENTS.THEME_SET, { theme }, { preferred_theme: theme });
}

/** Sim reach — opened a sim (once per sim per session; fired from SimOpenTracker). */
export async function trackSimOpened(simId: string, via: "path" | "xp"): Promise<void> {
  const id = await userId();
  if (!id) return;
  await captureServer(id, EVENTS.SIM_OPENED, { sim_id: simId, via });
}

/** Metric #11 (denominator) — opened the reels screen. */
export async function trackReelsOpened(): Promise<void> {
  const id = await userId();
  if (!id) return;
  await captureServer(id, EVENTS.REELS_OPENED, {});
}

/**
 * Metric #11 (numerator input) — visible seconds spent on the reels screen for
 * one visit. Summed per user over the week; < 60s total = shallow engagement.
 */
export async function trackReelsScreenTime(seconds: number): Promise<void> {
  const id = await userId();
  if (!id) return;
  await captureServer(id, EVENTS.REELS_SCREEN_TIME, { seconds: Math.round(seconds) });
}
