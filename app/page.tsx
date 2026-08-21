import { Button } from "@/components/ui/button";
import { RuneMascot } from "@/components/brand/RuneMascot";
import { RuneLoader } from "@/components/brand/RuneLoader";

/**
 * TEMPORARY foundation style-tile (Slice 0). Proves the Teal & Coral token system,
 * type ramp, and brand primitives render before real screens exist. Replaced by the
 * real splash → auth → dashboard flow in Slice 1.
 */
const SWATCHES: { name: string; varName: string; ink: string }[] = [
  { name: "teal", varName: "--teal", ink: "#fff" },
  { name: "teal-deep", varName: "--teal-deep", ink: "#fff" },
  { name: "coral", varName: "--coral", ink: "#fff" },
  { name: "violet", varName: "--violet", ink: "#fff" },
  { name: "amber", varName: "--amber", ink: "#14201e" },
  { name: "success", varName: "--success", ink: "#fff" },
  { name: "error", varName: "--error", ink: "#fff" },
];

export default function FoundationTile() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet">
        Slice 0 · Foundation
      </p>
      <h1 className="mt-1 text-3xl font-extrabold text-foreground">
        AI &amp; Tech for Professionals
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Teal &amp; Coral · &ldquo;Lively Pro&rdquo;. This tile verifies tokens, type,
        and the Rune primitives. Not a real screen.
      </p>

      {/* palette */}
      <section className="mt-8">
        <h2 className="mb-3 text-base font-bold">Palette</h2>
        <div className="grid grid-cols-4 gap-2">
          {SWATCHES.map((s) => (
            <div
              key={s.name}
              className="flex h-16 items-end rounded-xl p-2 text-[10px] font-semibold shadow-card"
              style={{ background: `var(${s.varName})`, color: s.ink }}
            >
              {s.name}
            </div>
          ))}
        </div>
      </section>

      {/* semantic surfaces + buttons */}
      <section className="mt-8 space-y-3">
        <h2 className="text-base font-bold">Components</h2>
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="text-sm text-card-foreground">
            Card surface. Border + resting shadow from tokens.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button>Primary (teal)</Button>
            <Button
              className="text-white hover:opacity-90"
              style={{ background: "var(--coral)" }}
            >
              Hero (coral)
            </Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
          </div>
        </div>
      </section>

      {/* mascot + loader */}
      <section className="mt-8">
        <h2 className="mb-3 text-base font-bold">Rune</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center rounded-2xl border bg-card p-4 shadow-card">
            <RuneMascot state="greet" spriteSrc="/mascot/rune-hero-clean.png" dimensions={140} />
            <span className="mt-2 text-xs text-muted-foreground">greet</span>
          </div>
          <div className="flex flex-col items-center rounded-2xl border bg-card p-4 shadow-card">
            <RuneLoader size={120} />
          </div>
        </div>
      </section>
    </main>
  );
}
