import { revalidatePath } from "next/cache";

/**
 * Revalidate every surface that reflects a user's progress — dashboard, streak
 * calendar, and profile (XP, streak, lessons/sims counts, badges, second-brain).
 *
 * Why this exists: those pages are `force-dynamic` (fresh on the server) but
 * Next's CLIENT Router Cache holds the last RSC payload per route, so after a
 * mutation on one tab, navigating to another tab (e.g. Reels → Profile) shows
 * stale data until its path is revalidated. Completion/save actions must call
 * this so a change shows up the moment the user lands on any of these screens.
 * Centralized so a new progress-mutating action can't silently forget one.
 */
export function revalidateProgress() {
  revalidatePath("/learn");
  revalidatePath("/learn/streak");
  revalidatePath("/profile");
}
