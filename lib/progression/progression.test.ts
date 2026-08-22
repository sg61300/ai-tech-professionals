import { describe, it, expect } from "vitest";
import { L1_SPINE } from "@/content";
import { computeNodeStates, nextPlayableLesson, isUnlocked } from "@/lib/progression";

describe("computeNodeStates", () => {
  it("opens only the first lesson for a brand-new user", () => {
    const s = computeNodeStates(L1_SPINE, new Set());
    expect(s.l1).toBe("current");
    expect(s.l2).toBe("locked");
    expect(s["taste-sim"]).toBe("locked");
    expect(s.l3).toBe("locked");
  });

  it("marks done lessons done and advances the frontier", () => {
    const s = computeNodeStates(L1_SPINE, new Set(["l1"]));
    expect(s.l1).toBe("done");
    expect(s.l2).toBe("current");
    expect(s.l3).toBe("locked");
  });

  it("unlocks the taste sim as 'available' (playable) once L1+L2 are done", () => {
    const s = computeNodeStates(L1_SPINE, new Set(["l1", "l2"]));
    expect(s.l2).toBe("done");
    expect(s["taste-sim"]).toBe("available"); // playable sim node
    expect(s.l3).toBe("current"); // lesson frontier moves on
  });

  it("keeps a not-yet-unlocked lesson locked even if a later prereq is met", () => {
    // l4 requires l3; completing l1,l2 must not open l4
    const s = computeNodeStates(L1_SPINE, new Set(["l1", "l2"]));
    expect(s.l4).toBe("locked");
  });

  it("marks the rapid-fire + full sim 'soon' after all five lessons are done", () => {
    const s = computeNodeStates(L1_SPINE, new Set(["l1", "l2", "l3", "l4", "l5"]));
    expect(s.l5).toBe("done");
    expect(s.rf1).toBe("soon");
    expect(s["sim-email"]).toBe("soon");
    expect(s["l2-locked"]).toBe("locked");
  });

  it("only ever marks one lesson 'current'", () => {
    const s = computeNodeStates(L1_SPINE, new Set(["l1", "l3"])); // l3 done out of order (defensive)
    const current = Object.entries(s).filter(([, v]) => v === "current");
    expect(current.length).toBeLessThanOrEqual(1);
  });
});

describe("isUnlocked", () => {
  it("is true when every prerequisite lesson is done", () => {
    expect(isUnlocked(L1_SPINE[3], new Set(["l2"]))).toBe(true); // l3 needs l2
    expect(isUnlocked(L1_SPINE[3], new Set())).toBe(false);
  });
});

describe("nextPlayableLesson", () => {
  it("returns the current lesson id to resume", () => {
    expect(nextPlayableLesson(L1_SPINE, new Set())).toBe("l1");
    expect(nextPlayableLesson(L1_SPINE, new Set(["l1"]))).toBe("l2");
    expect(nextPlayableLesson(L1_SPINE, new Set(["l1", "l2"]))).toBe("l3");
  });

  it("returns null once all lessons are done", () => {
    expect(nextPlayableLesson(L1_SPINE, new Set(["l1", "l2", "l3", "l4", "l5"]))).toBeNull();
  });
});
