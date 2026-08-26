import type { Flavor, Seniority } from "@/content/schema";
import { SENIORITIES } from "@/content/schema";

/**
 * Seniority-flavoring seam (settled decision: "org seniority only flavors
 * examples"). Given a lesson's optional `flavor` map and the learner's stored
 * `profiles.seniority`, return the example line for their level, or null.
 *
 * Robust by design: flavoring is purely ADDITIVE. If the lesson has no flavor,
 * the seniority is unknown/unset, or that level simply wasn't authored, we
 * return null and the runner shows nothing — the path is identical for everyone.
 * No fallback to another level (a "mid" example shown to a "senior" would be a
 * subtle lie about who it's for), so absent means absent.
 */
export function isSeniority(value: string | null | undefined): value is Seniority {
  return value != null && (SENIORITIES as readonly string[]).includes(value);
}

export function flavorFor(
  flavor: Flavor | undefined,
  seniority: string | null | undefined,
): string | null {
  if (!flavor || !isSeniority(seniority)) return null;
  return flavor[seniority] ?? null;
}
