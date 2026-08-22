import { RuneLoader } from "@/components/brand/RuneLoader";

/** "Rune is Tuning" while the Learn home server-renders. */
export default function Loading() {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
      <RuneLoader size={200} />
    </div>
  );
}
