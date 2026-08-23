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

/**
 * Jagged "electric arc" polyline along the route (matches the confirmed
 * prototype's `.parc`). Zig-zags perpendicular to each segment so the animated
 * glow reads as a lightning bolt rather than a smooth line.
 */
function jaggedArc(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len; // unit perpendicular
    const py = dx / len;
    const steps = Math.max(4, Math.round(len / 16));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const amp = (k % 2 === 0 ? 1 : -1) * 9;
      pts.push({ x: a.x + dx * t + px * amp, y: a.y + dy * t + py * amp });
    }
  }
  pts.push(points[points.length - 1]);
  return "M" + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L");
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
  // Electric arc is JAGGED (lightning) and confined to JUST the active segment
  // (current node → next node) so the animated bolt accents where you are, and
  // never sprawls over the locked milestone labels further down the path.
  const arc = jaggedArc(centers.slice(frontier, frontier + 2));

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
    }
    // Small on-path card anchored to the CURRENT node (kept alongside the top
    // Continue hero — "card = BOTH"). Sits on the side away from the node.
    if (isLesson && state === "current") {
      const anyDone = Object.values(states).includes("done");
      const nodeOnLeft = left(i) <= 50;
      // Card sits on the side opposite the node with a hard gap that clears the
      // node even when it magnifies to 1.5x (node ~9% of width at its center),
      // so it can grow without ever overlapping the node.
      node.card = {
        kick: anyDone ? "Continue" : "Start here",
        num: s.id.replace(/^l/, ""),
        title: s.title,
        left: nodeOnLeft ? "60%" : "4%",
        top: topPct,
        width: nodeOnLeft ? "32%" : "36%",
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
      const onRight = left(i) <= 50;
      const small =
        state === "locked" ? "LOCKED" : state === "soon" ? "COMING SOON" : undefined;
      // Pushed to the outer edge (away from the winding path) so the label
      // never sits on top of the line, even when it magnifies on scroll.
      node.vlab = {
        bold: s.title,
        small,
        left: onRight ? "64%" : "3%",
        top: topPct,
        width: onRight ? "33%" : "40%",
        align: onRight ? "left" : "right",
      };
    }
    return node;
  });

  return { done, base, arc, nodes };
}
