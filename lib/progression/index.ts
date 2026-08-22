import type { SpineNode } from "@/content";

/**
 * Progression logic — the pure, testable core that decides what a learner can
 * see and tap on the Learn path. Given the ordered spine and the set of
 * completed lesson ids (from Supabase `lesson_progress`), it derives each
 * node's state. No IO, no framework: called from the Learn Server Component and
 * unit-tested directly (IMPLEMENTATION-PLAN §4).
 */

export type NodeState =
  | "done" // lesson finished
  | "current" // the one lesson to resume next
  | "available" // unlocked lesson, not current (defensive; linear path rarely hits this)
  | "soon" // unlocked non-lesson node this build can't run yet (coming-soon)
  | "locked"; // prerequisites not met

/** A node is unlocked once every prerequisite lesson is in `completed`. */
export function isUnlocked(node: SpineNode, completed: Set<string>): boolean {
  return node.unlockAfter.every((id) => completed.has(id));
}

/**
 * Map every spine node to its state. Exactly one lesson is marked "current":
 * the first unlocked, not-done lesson in spine order.
 */
export function computeNodeStates(
  spine: SpineNode[],
  completed: Set<string>,
): Record<string, NodeState> {
  const out: Record<string, NodeState> = {};
  let currentAssigned = false;

  for (const node of spine) {
    // A "lock" node (e.g. Level 2 outline) is always locked in MVP.
    if (node.kind === "lock" || !isUnlocked(node, completed)) {
      out[node.id] = "locked";
      continue;
    }
    if (node.kind === "lesson") {
      if (completed.has(node.id)) {
        out[node.id] = "done";
      } else if (!currentAssigned) {
        out[node.id] = "current";
        currentAssigned = true;
      } else {
        out[node.id] = "available";
      }
    } else {
      // sim / rapid-fire / lock: unlocked but only "soon" if this build can run it.
      out[node.id] = node.playable ? "available" : "soon";
    }
  }
  return out;
}

/** The lesson id the learner should resume (first unlocked, not-done), or null. */
export function nextPlayableLesson(spine: SpineNode[], completed: Set<string>): string | null {
  for (const node of spine) {
    if (node.kind !== "lesson") continue;
    if (isUnlocked(node, completed) && !completed.has(node.id)) return node.id;
  }
  return null;
}
