/**
 * Where a simulation's Back button should return.
 *
 * When a sim is opened from the Simulations tab, `SimCard` links to it with
 * `?from=sims`; in that case Back returns to `/sims`. Every other entry point
 * (the learn-path nodes) omits the marker, so Back keeps going to the learn
 * dashboard exactly as before — this is purely additive.
 *
 * Read from the live URL at click time (not via `useSearchParams`) so no
 * Suspense boundary is required and static rendering is unaffected.
 */
export function simBackHref(): string {
  if (typeof window === "undefined") return "/learn";
  return new URLSearchParams(window.location.search).get("from") === "sims"
    ? "/sims"
    : "/learn";
}
