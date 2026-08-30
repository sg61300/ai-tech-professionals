import type { SpineNode } from "@/content";
import type { NodeState } from "@/lib/progression";
import type { PathData, PathNode, PathNodeKind } from "@/components/brand/LessonPath";

/**
 * Build a data-driven PathData for the Learn home from the spine + live node
 * states. Geometry is generated (not hand-authored) so the path always matches
 * whatever the spine holds. Coordinates: the SVG viewBox is 240x920 stretched
 * to the container, so an svg point is just (left% * 2.4, top% * 9.2) and node
 * CSS left/top use the same percentages.
 */

// Winding lanes (as % of width), cycled down the path for the zig-zag feel.
const LANES = [25, 62.5, 77, 50, 30, 62.5, 77, 45, 60];

const KIND_BY_STATE: Record<NodeState, PathNodeKind> = {
  done: "done",
  current: "cur",
  available: "next",
  soon: "sim",
  locked: "lock",
};

function pt(leftPct: number, topPct: number) {
  return { x: leftPct * 2.4, y: topPct * 9.2 };
}

/** Smooth vertical S-curve through the given points as an SVG path `d`. */
function curve(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const my = ((a.y + b.y) / 2).toFixed(1);
    d += ` C${a.x.toFixed(1)},${my} ${b.x.toFixed(1)},${my} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  }
  return d;
}

// --- Electric arc: twin-crackle bolts (chosen style #14, plasma colours #15) --
type Pt = { x: number; y: number };

/** Deterministic pseudo-random in [-1,1] so SSR and client render the same bolt. */
function rnd(i: number, seed: number): number {
  return (Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453) % 1;
}
/** A bowed arc of N points bulging to one side (bell-shaped). */
function arcPts(a: Pt, b: Pt, bow: number, N = 14): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const pts: Pt[] = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const bell = Math.sin(t * Math.PI) * bow;
    pts.push({ x: a.x + dx * t + px * bell, y: a.y + dy * t + py * bell });
  }
  return pts;
}
/** Add jagged electric jitter perpendicular to the local direction. */
function roughen(pts: Pt[], amp: number, seed = 0): Pt[] {
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p;
    const a = pts[i - 1];
    const c = pts[i + 1];
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const o = rnd(i, seed) * amp;
    return { x: p.x + (-dy / l) * o, y: p.y + (dx / l) * o };
  });
}
const toPath = (pts: Pt[]) => "M" + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L");

/** Two offset jagged bolts (twin crackle) between the two given points. */
function twinCrackle(seg: Pt[]): { arc: string; arc2: string } {
  if (seg.length < 2) return { arc: "", arc2: "" };
  return {
    arc: toPath(roughen(arcPts(seg[0], seg[1], 9), 3.5, 2)),
    arc2: toPath(roughen(arcPts(seg[0], seg[1], -7), 3.5, 9)),
  };
}

export function buildLearnPath(spine: SpineNode[], states: Record<string, NodeState>): PathData {
  const n = spine.length;
  const top = (i: number) => 5 + (i * 90) / Math.max(1, n - 1);
  const left = (i: number) => LANES[i % LANES.length];
  const centers = spine.map((_, i) => pt(left(i), top(i)));

  // Frontier = the current lesson, else the last done node (fully-done path is all green).
  let frontier = spine.findIndex((s) => states[s.id] === "current");
  if (frontier < 0) {
    for (let i = 0; i < n; i++) if (states[spine[i].id] === "done") frontier = i;
  }
  if (frontier < 0) frontier = 0;

  const done = curve(centers.slice(0, frontier + 1));
  const base = curve(centers.slice(frontier));
  // Electric arc = twin-crackle bolts (chosen style #14, plasma colours #15),
  // confined to JUST the active segment (current node → next node) so the
  // animated discharge accents where you are and never sprawls over the locked
  // milestone labels further down the path.
  const { arc, arc2 } = twinCrackle(centers.slice(frontier, frontier + 2));

  const nodes: PathNode[] = spine.map((s, i) => {
    const state = states[s.id];
    const kind = KIND_BY_STATE[state];
    const isLesson = s.kind === "lesson";
    // Prefer the node's topic glyph (an icon of what the lesson is about); fall
    // back to the lesson number only if none is set, and "•" for other nodes.
    const label = s.glyph ?? (isLesson ? s.id.replace(/^l/, "") : "•");
    const leftPct = `${left(i)}%`;
    const topPct = `${top(i)}%`;

    const node: PathNode = {
      kind,
      label,
      left: leftPct,
      top: topPct,
      // Playable sims show the ripple ring; unbuilt milestones ("soon") too.
      ring: (s.kind === "sim" || s.kind === "taste") && (state === "available" || state === "soon"),
    };
    if (isLesson && (state === "current" || state === "done" || state === "available")) {
      node.href = `/learn/lesson/${s.id}`;
      node.ariaLabel = `${state === "done" ? "Review" : "Start"} lesson: ${s.title}`;
    }
    // Small on-path card anchored to the CURRENT node (kept alongside the top
    // Continue hero — "card = BOTH"). Sits on the side away from the node.
    if (isLesson && state === "current") {
      const anyDone = Object.values(states).includes("done");
      // Card sits on the side OPPOSITE the node, in the outer margin (never
      // crossing the winding path). It is NOT scaled on scroll (see LessonPath),
      // so these fixed insets keep it clear of the node and inside the app.
      const nodeOnLeft = left(i) <= 50;
      node.card = {
        kick: anyDone ? "Continue" : "Start here",
        num: s.id.replace(/^l/, ""),
        title: s.title,
        left: nodeOnLeft ? "67%" : "3%",
        top: topPct,
        width: nodeOnLeft ? "30%" : "34%",
        align: nodeOnLeft ? "left" : "right",
      };
    }
    if (s.kind === "taste" && (state === "available" || state === "done")) {
      node.href = `/learn/sim/${s.id}`;
      node.ariaLabel = `${state === "done" ? "Replay" : "Start"}: ${s.title}`;
    } else if (s.kind === "rapidfire" && (state === "available" || state === "done")) {
      node.href = `/learn/rf/${s.id}`;
      node.ariaLabel = `${state === "done" ? "Replay" : "Start"}: ${s.title}`;
    } else if (s.kind === "sim" && (state === "available" || state === "done")) {
      node.href = `/learn/sim/${s.id}`;
      node.ariaLabel = `${state === "done" ? "Replay" : "Start"}: ${s.title}`;
    }

    // Side labels for the non-lesson milestones so learners know what's ahead.
    if (!isLesson) {
      const onRight = left(i) <= 50; // node on the left half → label on the right
      const small =
        state === "locked" ? "LOCKED" : state === "soon" ? "COMING SOON" : undefined;
      // Outer-margin placement (NOT scaled on scroll) so the label never sweeps
      // across the winding path or a neighbouring node.
      node.vlab = {
        bold: s.title,
        small,
        tone:
          s.kind === "taste" || s.kind === "sim" || s.kind === "rapidfire"
            ? s.kind
            : undefined,
        left: onRight ? "64%" : "3%",
        top: topPct,
        width: onRight ? "33%" : "40%",
        align: onRight ? "left" : "right",
      };
    }
    return node;
  });

  return { done, base, arc, arc2, nodes };
}
