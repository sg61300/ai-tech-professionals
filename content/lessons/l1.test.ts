import { describe, it, expect } from "vitest";
import { LESSONS, L1_SPINE, getLesson } from "@/content";
import { LessonSchema, FlavorSchema } from "@/content/schema";
import { isUnlocked } from "@/lib/progression";
import { flavorFor } from "@/lib/flavor";

/**
 * Level-1 (Slice 2) content integrity: the whole 12-lesson curriculum, the
 * 3 units, and the spine walkability. Guards the PRD/04 progression so a
 * mis-authored unlock order or a missing lesson can't ship.
 */

const LESSON_IDS = ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9", "l10", "l11", "l12"];

describe("Level 1 lessons", () => {
  it("has all 12 lessons, uniquely ided, l1..l12", () => {
    expect(LESSONS).toHaveLength(12);
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(12);
    expect(new Set(ids)).toEqual(new Set(LESSON_IDS));
  });

  it("every lesson validates against the schema", () => {
    for (const l of LESSONS) expect(() => LessonSchema.parse(l)).not.toThrow();
  });

  it("units are assigned correctly (1: l1-5, 2: l6-10, 3: l11-12)", () => {
    const unitOf = (id: string) => getLesson(id)!.unit;
    ["l1", "l2", "l3", "l4", "l5"].forEach((id) => expect(unitOf(id)).toBe(1));
    ["l6", "l7", "l8", "l9", "l10"].forEach((id) => expect(unitOf(id)).toBe(2));
    ["l11", "l12"].forEach((id) => expect(unitOf(id)).toBe(3));
  });

  it("every lesson has an mcq exercise with an in-range answer", () => {
    for (const l of LESSONS) {
      expect(l.exercise.kind).toBe("mcq");
      if (l.exercise.kind === "mcq") {
        expect(l.exercise.answer).toBeGreaterThanOrEqual(0);
        expect(l.exercise.answer).toBeLessThan(l.exercise.options.length);
      }
    }
  });

  it("any authored flavor is a valid partial seniority map", () => {
    for (const l of LESSONS) {
      if (l.flavor) expect(() => FlavorSchema.parse(l.flavor)).not.toThrow();
    }
  });
});

describe("L1 spine (PRD/04 progression)", () => {
  it("contains all 12 lessons in order plus the sims/RF and the L2 lock", () => {
    const lessonNodes = L1_SPINE.filter((n) => n.kind === "lesson").map((n) => n.id);
    expect(lessonNodes).toEqual(LESSON_IDS);
    expect(L1_SPINE.map((n) => n.id)).toContain("taste-sim");
    expect(L1_SPINE.map((n) => n.id)).toContain("rf1");
    expect(L1_SPINE.map((n) => n.id)).toContain("rf2");
    expect(L1_SPINE.map((n) => n.id)).toContain("sim-email");
    expect(L1_SPINE.map((n) => n.id)).toContain("sim-system");
    expect(L1_SPINE[L1_SPINE.length - 1]).toMatchObject({ id: "l2-locked", kind: "lock", playable: false });
  });

  it("rf2 gates on Unit 2 and sim-system gates on rf2", () => {
    const rf2 = L1_SPINE.find((n) => n.id === "rf2")!;
    expect(rf2.unlockAfter).toEqual(["l6", "l7", "l8", "l9", "l10"]);
    const sys = L1_SPINE.find((n) => n.id === "sim-system")!;
    expect(sys.unlockAfter).toContain("rf2");
  });

  it("is walkable: completing each node in order unlocks the next", () => {
    const completed = new Set<string>();
    for (const node of L1_SPINE) {
      if (node.kind === "lock") continue; // L2 stays locked in MVP
      expect(isUnlocked(node, completed)).toBe(true);
      completed.add(node.id);
    }
  });

  it("every non-lesson prerequisite references a real earlier node", () => {
    const seen = new Set<string>();
    for (const node of L1_SPINE) {
      for (const dep of node.unlockAfter) {
        expect(seen.has(dep)).toBe(true); // dependency appears before the node
      }
      seen.add(node.id);
    }
  });
});

describe("flavor seam wiring", () => {
  it("l2 flavors differ per seniority and are null for an unknown level", () => {
    const l2 = getLesson("l2")!;
    expect(flavorFor(l2.flavor, "entry")).not.toBeNull();
    expect(flavorFor(l2.flavor, "senior")).not.toBeNull();
    expect(flavorFor(l2.flavor, "entry")).not.toBe(flavorFor(l2.flavor, "senior"));
    expect(flavorFor(l2.flavor, "director")).toBeNull();
  });

  it("an un-flavored lesson yields null for every seniority", () => {
    const l1 = getLesson("l1")!;
    expect(l1.flavor).toBeUndefined();
    for (const s of ["entry", "mid", "senior"]) expect(flavorFor(l1.flavor, s)).toBeNull();
  });
});
