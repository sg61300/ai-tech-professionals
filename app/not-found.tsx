import Link from "next/link";

/** Readable 404 (the default one rendered near-black on our dark surface). */
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "70dvh",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: "22rem" }}>
        <div style={{ fontSize: "56px" }}>🐉</div>
        <h1
          style={{
            fontFamily: "var(--font-heading), sans-serif",
            fontSize: "26px",
            fontWeight: 800,
            color: "var(--foreground)",
          }}
        >
          Page not found
        </h1>
        <p style={{ color: "var(--muted-foreground)", marginTop: "6px" }}>
          Rune looked everywhere. That page does not exist yet.
        </p>
        <Link
          href="/learn"
          style={{
            display: "inline-block",
            marginTop: "18px",
            padding: "12px 22px",
            borderRadius: "14px",
            background: "var(--coral)",
            color: "#fff",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Back to Learn
        </Link>
      </div>
    </main>
  );
}
