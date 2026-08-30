import { L1_UNIT1 } from "@/content/lessons/l1-unit1";
import { L1_UNIT2 } from "@/content/lessons/l1-unit2";
import { L1_UNIT3 } from "@/content/lessons/l1-unit3";
import { TASTE_SIM } from "@/content/sims/taste";
import { EMAIL_SIM } from "@/content/sims/email";
import { SYSTEM_SIM } from "@/content/sims/system";
import { BIAS_SIM } from "@/content/sims/bias";
import { RF1 } from "@/content/rapidfire/rf1";
import { RF2 } from "@/content/rapidfire/rf2";
import {
  LessonSchema,
  TasteSimSchema,
  EmailSimSchema,
  SystemSimSchema,
  BiasSimSchema,
  RapidFireSetSchema,
  type Lesson,
  type TasteSim,
  type EmailSim,
  type SystemSim,
  type BiasSim,
  type RapidFireSet,
} from "@/content/schema";

/**
 * Content registry (git = source of truth, IMPLEMENTATION-PLAN §3.5). The app
 * reads this in-repo copy directly (no runtime fetch); the seed script mirrors
 * it into Supabase one-way. Everything here is validated against the Zod schema
 * at import so malformed content can never ship.
 */

export const LESSONS: Lesson[] = [...L1_UNIT1, ...L1_UNIT2, ...L1_UNIT3].map((l) =>
  LessonSchema.parse(l),
);

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
  // --- Unit 1: Foundations & First Wins ---
  { id: "l1", kind: "lesson", title: "What AI really is", glyph: "🤖", unlockAfter: [], playable: true },
  { id: "l2", kind: "lesson", title: "Anatomy of a great prompt", glyph: "✍️", unlockAfter: ["l1"], playable: true },
  {
    id: "taste-sim",
    kind: "taste",
    title: "Taste Sim",
    glyph: "🏁",
    unlockAfter: ["l1", "l2"],
    playable: true,
  },
  { id: "l3", kind: "lesson", title: "Context is everything", glyph: "🧩", unlockAfter: ["l2"], playable: true },
  { id: "l4", kind: "lesson", title: "Tokens & the context window", glyph: "🎟️", unlockAfter: ["l3"], playable: true },
  { id: "l5", kind: "lesson", title: "Iterating like a pro", glyph: "🔁", unlockAfter: ["l4"], playable: true },
  {
    id: "rf1",
    kind: "rapidfire",
    title: "Rapid Fire · Foundations",
    glyph: "⚡",
    unlockAfter: ["l1", "l2", "l3", "l4", "l5"],
    playable: true,
  },
  {
    id: "sim-email",
    kind: "sim",
    title: "Sim: Inbox Tamer",
    glyph: "📧",
    // Gated behind RF1: passing the rapid fire unlocks the first full sim (PRD/11).
    unlockAfter: ["l1", "l2", "l3", "l4", "l5", "rf1"],
    playable: true,
  },
  // --- Unit 2: The HR Daily Toolkit ---
  { id: "l6", kind: "lesson", title: "Inbox triage", glyph: "📥", unlockAfter: ["l5"], playable: true },
  { id: "l7", kind: "lesson", title: "Notes to minutes", glyph: "📝", unlockAfter: ["l6"], playable: true },
  { id: "l8", kind: "lesson", title: "Presentation outlining", glyph: "📊", unlockAfter: ["l7"], playable: true },
  { id: "l9", kind: "lesson", title: "Query handling", glyph: "💬", unlockAfter: ["l8"], playable: true },
  { id: "l10", kind: "lesson", title: "When NOT to trust AI", glyph: "⚠️", unlockAfter: ["l9"], playable: true },
  {
    id: "rf2",
    kind: "rapidfire",
    title: "Rapid Fire · Daily Toolkit",
    glyph: "⚡",
    // Covers Lessons 6-10; passing unlocks the second full sim (PRD/11).
    unlockAfter: ["l6", "l7", "l8", "l9", "l10"],
    playable: true,
  },
  {
    id: "sim-system",
    kind: "sim",
    title: "Sim: System X-Ray",
    glyph: "🩻",
    // PRD/04 sequencing: unlocks after Rapid-fire 2. RF completion writes a
    // node-ledger row (id="rf2") so this opens once RF2 is passed.
    unlockAfter: ["l6", "l7", "l8", "l9", "l10", "rf2"],
    playable: true,
  },
  // --- Unit 3: Think Like a Decision-Maker (capstone) ---
  { id: "l11", kind: "lesson", title: "Your second brain", glyph: "🧠", unlockAfter: ["l10"], playable: true },
  { id: "l12", kind: "lesson", title: "Decision-maker capstone", glyph: "🎯", unlockAfter: ["l11"], playable: true },
  {
    id: "sim-bias",
    kind: "sim",
    title: "Sim: Bias Catcher",
    glyph: "⚖️",
    // The L1 capstone sim (spec §4.3): everything through System X-Ray must be done.
    unlockAfter: ["l6", "l7", "l8", "l9", "l10", "rf2", "sim-system"],
    playable: true,
  },
  // Level 1 complete -> Level 2 revealed as a locked outline.
  { id: "l2-locked", kind: "lock", title: "Level 2", glyph: "🔒", unlockAfter: [], playable: false },
];

/** XP awarded for finishing a lesson (kept here so the runner and seed agree). */
export const LESSON_XP = 20;

/** The taste sim, validated at import (its own XP lives on the object). */
export const tasteSim: TasteSim = TasteSimSchema.parse(TASTE_SIM);
export const getSim = (id: string): TasteSim | undefined =>
  id === tasteSim.id ? tasteSim : undefined;

/** The email sim ("Inbox Tamer"), validated at import. */
export { EMAIL_SIM };
export const emailSim: EmailSim = EmailSimSchema.parse(EMAIL_SIM);
export const getEmailSim = (id: string): EmailSim | undefined =>
  id === emailSim.id ? emailSim : undefined;

/** The system-explainer sim ("System X-Ray"), validated at import. */
export { SYSTEM_SIM };
export const systemSim: SystemSim = SystemSimSchema.parse(SYSTEM_SIM);
export const getSystemSim = (id: string): SystemSim | undefined =>
  id === systemSim.id ? systemSim : undefined;

/** The Bias Catcher sim (L1 capstone), validated at import. */
export { BIAS_SIM };
export const biasSim: BiasSim = BiasSimSchema.parse(BIAS_SIM);
export const getBiasSim = (id: string): BiasSim | undefined =>
  id === biasSim.id ? biasSim : undefined;

/** XP awarded for PASSING a rapid-fire round (fixed; the in-round tally is cosmetic). */
export const RAPIDFIRE_XP = 50;

/** Rapid-fire sets, validated at import. */
export { RF1, RF2 };
export const RAPIDFIRE_SETS: RapidFireSet[] = [RF1, RF2].map((s) => RapidFireSetSchema.parse(s));
const RF_BY_ID = new Map(RAPIDFIRE_SETS.map((s) => [s.id, s]));
export const getRapidFire = (id: string): RapidFireSet | undefined => RF_BY_ID.get(id);
export const isRapidFireId = (id: string): boolean => RF_BY_ID.has(id);
