import { L1_UNIT1 } from "@/content/lessons/l1-unit1";
import { TASTE_SIM } from "@/content/sims/taste";
import { LessonSchema, TasteSimSchema, type Lesson, type TasteSim } from "@/content/schema";

/**
 * Content registry (git = source of truth, IMPLEMENTATION-PLAN §3.5). The app
 * reads this in-repo copy directly (no runtime fetch); the seed script mirrors
 * it into Supabase one-way. Everything here is validated against the Zod schema
 * at import so malformed content can never ship.
 */

export const LESSONS: Lesson[] = [...L1_UNIT1].map((l) => LessonSchema.parse(l));

const LESSON_BY_ID = new Map(LESSONS.map((l) => [l.id, l]));
export const getLesson = (id: string): Lesson | undefined => LESSON_BY_ID.get(id);
export const isLessonId = (id: string): boolean => LESSON_BY_ID.has(id);

/**
 * The Level-1 spine (PRD/04 progression). Ordered exactly as the learner walks
 * it. `unlockAfter` lists the lesson ids that must be `done` before a node
 * opens; `playable` marks what this build can actually run (lessons ship now;
 * the taste sim, rapid-fire, and full sim are gated "coming soon" until their
 * slices land, mirroring the L2/L3 locked-outline pattern).
 */
export type SpineNodeKind = "lesson" | "taste" | "rapidfire" | "sim" | "lock";

export type SpineNode = {
  id: string;
  kind: SpineNodeKind;
  title: string;
  /** Glyph shown on the path node for non-lesson nodes. */
  glyph?: string;
  unlockAfter: string[];
  playable: boolean;
};

export const L1_SPINE: SpineNode[] = [
  { id: "l1", kind: "lesson", title: "What AI really is", unlockAfter: [], playable: true },
  { id: "l2", kind: "lesson", title: "Anatomy of a great prompt", unlockAfter: ["l1"], playable: true },
  {
    id: "taste-sim",
    kind: "taste",
    title: "Taste Sim",
    glyph: "🏁",
    unlockAfter: ["l1", "l2"],
    playable: false,
  },
  { id: "l3", kind: "lesson", title: "Context is everything", unlockAfter: ["l2"], playable: true },
  { id: "l4", kind: "lesson", title: "Tokens & the context window", unlockAfter: ["l3"], playable: true },
  { id: "l5", kind: "lesson", title: "Iterating like a pro", unlockAfter: ["l4"], playable: true },
  {
    id: "rf1",
    kind: "rapidfire",
    title: "Rapid Fire",
    glyph: "⚡",
    unlockAfter: ["l1", "l2", "l3", "l4", "l5"],
    playable: false,
  },
  {
    id: "sim-email",
    kind: "sim",
    title: "Sim: Inbox Tamer",
    glyph: "📧",
    unlockAfter: ["l1", "l2", "l3", "l4", "l5"],
    playable: false,
  },
  { id: "l2-locked", kind: "lock", title: "Level 2", glyph: "🔒", unlockAfter: [], playable: false },
];

/** XP awarded for finishing a lesson (kept here so the runner and seed agree). */
export const LESSON_XP = 20;

/** The taste sim, validated at import (its own XP lives on the object). */
export const tasteSim: TasteSim = TasteSimSchema.parse(TASTE_SIM);
export const getSim = (id: string): TasteSim | undefined =>
  id === tasteSim.id ? tasteSim : undefined;
