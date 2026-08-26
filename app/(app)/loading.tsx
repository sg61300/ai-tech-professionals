import { RuneLoader } from "@/components/brand/RuneLoader";

/**
 * Shared "Rune is Tuning" loader for the whole (app) group. Next shows this
 * whenever a child route segment without its own loading.tsx (e.g. Reels,
 * Articles) suspends while its server component renders. Routes with a more
 * specific loading.tsx (learn, profile, lesson, sim, rf, streak) still win.
 */
export default function Loading() {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
      <RuneLoader size={200} />
    </div>
  );
}
