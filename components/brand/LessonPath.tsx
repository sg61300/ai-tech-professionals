/**
 * LessonPath — the vertical winding path with electric-AI arcs and arc-reactor
 * nodes (ADR-015/017). Presentational + data-driven: Learn home feeds it live
 * lesson_progress; the onboarding L2/L3 "coming soon" preview feeds it the L1
 * layout with `greyed`. Ported faithfully from Design/learn-home-prototype.html.
 */

export type PathNodeKind = "done" | "dsim" | "cur" | "next" | "sim" | "lock";

export type PathNode = {
  kind: PathNodeKind;
  /** Glyph or number rendered inside the node. */
  label: string;
  left: string;
  top: string;
  /** Sim nodes get an animated ripple ring. */
  ring?: boolean;
  vlab?: {
    text?: string;
    bold?: string;
    small?: string;
    left: string;
    top: string;
    width: string;
    align?: "left" | "right";
  };
};

export type PathData = {
  /** SVG `d` for the completed (green) spine. */
  done: string;
  /** SVG `d` for the dotted upcoming spine. */
  base: string;
  /** SVG `d` for the electric arc overlay. */
  arc: string;
  nodes: PathNode[];
  dividers?: { text: string; top: string }[];
};

export function LessonPath({ data, greyed = false }: { data: PathData; greyed?: boolean }) {
  return (
    <div className={`lesson-path${greyed ? " greyed" : ""}`} aria-hidden={greyed || undefined}>
      <div className="vtrail">
        <svg viewBox="0 0 240 920" preserveAspectRatio="none" aria-hidden="true">
          <path d={data.done} fill="none" stroke="#22C55E" strokeWidth={6} strokeLinecap="round" />
          <path className="base" d={data.base} />
          <path className="parc" d={data.arc} />
          <path className="parc hot" d={data.arc} />
        </svg>

        {data.dividers?.map((d, i) => (
          <span key={`div-${i}`} className="udiv" style={{ top: d.top }}>
            {d.text}
          </span>
        ))}

        {data.nodes.map((n, i) => (
          <span key={`n-${i}`}>
            {n.ring && <span className="simring" style={{ left: n.left, top: n.top }} />}
            <span className={`pn ${n.kind}`} style={{ left: n.left, top: n.top }}>
              {n.label}
            </span>
            {n.vlab && (
              <span
                className="vlab"
                style={{
                  left: n.vlab.left,
                  top: n.vlab.top,
                  width: n.vlab.width,
                  textAlign: n.vlab.align,
                }}
              >
                {n.vlab.bold ? <b>{n.vlab.bold}</b> : n.vlab.text}
                {n.vlab.small && <small>{n.vlab.small}</small>}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Representative Level-1 path layout (from the mockup). Used for the greyed
 * onboarding preview now; Learn home will build its own PathData from live rows.
 */
export const L1_PREVIEW_PATH: PathData = {
  done: "M60,40 C60,80 150,80 150,120 C150,162 185,162 185,205 C185,247 120,247 120,290 C120,332 60,332 60,375 C60,417 95,417 95,460 C95,502 150,502 150,545",
  base: "M150,545 C150,590 185,590 185,635 C185,677 120,677 120,720 C120,762 70,762 70,805 C70,847 150,847 150,890",
  arc: "M150,545 L172,557 L136,571 L178,585 L146,599 L188,613 L154,627 L192,641 L158,655 L134,669 L174,683 L130,697 L158,711 L118,721 L150,735 L106,749 L92,763 L116,777 L78,791 L70,805",
  dividers: [{ text: "Unit 2 · Prompting", top: "45.5%" }],
  nodes: [
    { kind: "done", label: "✓", left: "25%", top: "4.3%" },
    { kind: "done", label: "✓", left: "62.5%", top: "13%" },
    {
      kind: "dsim",
      label: "🏁",
      left: "77%",
      top: "22.3%",
      vlab: { text: "Taste Sim ✓", left: "6%", top: "22.3%", width: "44%", align: "right" },
    },
    { kind: "done", label: "✓", left: "50%", top: "31.5%" },
    { kind: "done", label: "✓", left: "25%", top: "40.8%" },
    { kind: "done", label: "✓", left: "39.6%", top: "50%" },
    { kind: "cur", label: "6", left: "62.5%", top: "59.2%" },
    {
      kind: "next",
      label: "7",
      left: "77%",
      top: "69%",
      vlab: { text: "Lesson 7", left: "6%", top: "69%", width: "44%", align: "right" },
    },
    {
      kind: "next",
      label: "⚡",
      left: "50%",
      top: "78.3%",
      vlab: { text: "Rapid Fire", left: "60%", top: "78.3%", width: "36%" },
    },
    {
      kind: "sim",
      label: "📧",
      left: "29.2%",
      top: "87.5%",
      ring: true,
      vlab: { bold: "Sim: Inbox Tamer", small: "AI HUB · LOCKED", left: "47%", top: "87.5%", width: "49%" },
    },
    { kind: "lock", label: "🔒", left: "62.5%", top: "96.7%" },
  ],
};
