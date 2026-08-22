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

  const nodes: PathNode[] = spine.map((s, i) => {
    const state = states[s.id];
    const kind = KIND_BY_STATE[state];
    const isLesson = s.kind === "lesson";
    const label = isLesson ? s.id.replace(/^l/, "") : (s.glyph ?? "•");
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
    } else if (s.kind === "taste" && state === "available") {
      node.href = `/learn/sim/${s.id}`;
      node.ariaLabel = `Start: ${s.title}`;
    }

    // Side labels for the non-lesson milestones so learners know what's ahead.
    if (!isLesson) {
      const onRight = left(i) <= 50;
      const small =
        state === "locked" ? "LOCKED" : state === "soon" ? "COMING SOON" : undefined;
      node.vlab = {
        bold: s.title,
        small,
        left: onRight ? "60%" : "6%",
        top: topPct,
        width: onRight ? "36%" : "44%",
        align: onRight ? "left" : "right",
      };
    }
    return node;
  });

  return { done, base, arc: base, nodes };
}
