/**
 * Greeting rule (implement once, use everywhere — IMPLEMENTATION-PLAN §3):
 * displayName = profile.avatar_name?.trim() || profile.name.
 */
export function displayName(p: {
  avatar_name?: string | null;
  name?: string | null;
}): string {
  return p.avatar_name?.trim() || p.name?.trim() || "there";
}
