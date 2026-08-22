import { TabBar } from "@/components/app/TabBar";

/**
 * Placeholder for the tabs whose full experience ships in a later slice
 * (Reels, Articles, Profile). Keeps the bottom-tab navigation working instead
 * of 404-ing, and renders inside the same app shell.
 */
export function ComingSoon({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <div className="lh">
      <main
        className="lh-content"
        style={{ display: "grid", placeItems: "center", textAlign: "center" }}
      >
        <div style={{ maxWidth: "22rem" }}>
          <div style={{ fontSize: "56px", marginBottom: "8px" }}>{emoji}</div>
          <h1
            style={{
              fontFamily: "var(--font-heading), sans-serif",
              fontSize: "24px",
              fontWeight: 800,
              marginBottom: "6px",
            }}
          >
            {title}
          </h1>
          <p style={{ color: "var(--muted-foreground)" }}>{sub}</p>
          <div
            style={{
              marginTop: "14px",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--teal)",
            }}
          >
            Coming soon
          </div>
        </div>
      </main>
      <TabBar />
    </div>
  );
}
