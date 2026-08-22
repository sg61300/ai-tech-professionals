import { z } from "zod";

/**
 * In-repo typed content = git is the source of truth (IMPLEMENTATION-PLAN §3.5,
 * Option A). Every /content/*.ts file is validated against these schemas at
 * build/test time so malformed content can never ship or reach the seed script.
 */

// --- Lesson body blocks -----------------------------------------------------
export const BlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), md: z.string().min(1) }),
  z.object({ type: z.literal("callout"), tone: z.enum(["info", "tip", "warn", "ai"]), md: z.string().min(1) }),
  z.object({ type: z.literal("image"), src: z.string().min(1), alt: z.string().min(1) }),
  z.object({ type: z.literal("quote"), md: z.string().min(1), by: z.string().optional() }),
]);
export type Block = z.infer<typeof BlockSchema>;

// --- Auto-graded exercises (constrained) ------------------------------------
const McqExercise = z.object({
  kind: z.literal("mcq"),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  answer: z.number().int().nonnegative(), // index into options
  feedback: z.object({ correct: z.string(), incorrect: z.string() }),
});
const OrderExercise = z.object({
  kind: z.literal("order"),
  prompt: z.string().min(1),
  items: z.array(z.string().min(1)).min(2),
  answer: z.array(z.number().int().nonnegative()), // correct order of item indices
  feedback: z.object({ correct: z.string(), incorrect: z.string() }),
});
const FillExercise = z.object({
  kind: z.literal("fill"),
  prompt: z.string().min(1),
  accept: z.array(z.string().min(1)).min(1), // accepted answers (case-insensitive)
  feedback: z.object({ correct: z.string(), incorrect: z.string() }),
});
export const ExerciseSchema = z.discriminatedUnion("kind", [McqExercise, OrderExercise, FillExercise]);
export type Exercise = z.infer<typeof ExerciseSchema>;

// --- Grill-me (scripted decision-maker beat) --------------------------------
export const GrillBeatSchema = z.object({
  prompt: z.string().min(1),
  // The learner must pick the `correct` branch to finish; a wrong pick shows its
  // retort (why it's off) and lets them retry. If no branch is marked, the FIRST
  // branch is treated as correct (authoring convention).
  branches: z
    .array(
      z.object({
        choice: z.string().min(1),
        retort: z.string().min(1),
        correct: z.boolean().optional(),
      }),
    )
    .min(2),
});
export type GrillBeat = z.infer<typeof GrillBeatSchema>;

// --- Lesson -----------------------------------------------------------------
export const LessonSchema = z.object({
  id: z.string().min(1),
  unit: z.number().int().positive(),
  title: z.string().min(1),
  blocks: z.array(BlockSchema).min(1),
  exercise: ExerciseSchema,
  grillBeat: GrillBeatSchema.optional(),
});
export type Lesson = z.infer<typeof LessonSchema>;

// --- Rapid-fire -------------------------------------------------------------
export const RapidFireItemSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correct: z.number().int().nonnegative(),
  grillStyle: z.string().optional(),
});
export type RapidFireItem = z.infer<typeof RapidFireItemSchema>;

// --- Simulations ------------------------------------------------------------
export const ScriptedRubricSchema = z.object({
  criteria: z.array(z.object({ label: z.string().min(1), maxScore: z.number().positive() })).min(1),
  improvement: z.string().min(1), // the one scripted "do this next time"
});

export const SimScriptSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["taste", "email", "system"]),
    steps: z.array(z.object({ id: z.string().min(1), prompt: z.string().min(1) })).min(1),
    grillBeats: z.array(GrillBeatSchema).default([]),
    rubric: ScriptedRubricSchema,
    fallback: z.object({ output: z.string().min(1), rubricNote: z.string().min(1) }),
    liveGen: z
      .object({
        prompt: z.string().min(1),
        curatedOptions: z.array(z.string().min(1)).optional(),
        allowFreeText: z.boolean().default(false),
      })
      .optional(),
  })
  // MVP rule (§6): taste + system are live (need liveGen); email is scripted rails (no liveGen).
  .refine((s) => (s.kind === "email" ? s.liveGen === undefined : true), {
    message: "email sim is scripted rails in MVP and must not define liveGen",
    path: ["liveGen"],
  })
  .refine((s) => (s.kind === "taste" || s.kind === "system" ? s.liveGen !== undefined : true), {
    message: "taste and system sims are live-AI and require liveGen",
    path: ["liveGen"],
  });
export type SimScript = z.infer<typeof SimScriptSchema>;

// --- Taste sim (PRD/08) -----------------------------------------------------
// A guided 4-part-prompt builder, structurally distinct from the generic
// SimScript (email/system, Slice 3): no rubric (success = completion), rich
// per-step interactions. Bespoke shape so we don't over-generalize the shared
// schema before the other sims exist.
const RoleOptionSchema = z.object({
  label: z.string().min(1),
  /** Text inserted into the prompt bar when chosen. */
  value: z.string().min(1),
  correct: z.boolean(),
  /** Playful one-liner shown when a wrong role is tapped (no penalty). */
  preview: z.string().optional(),
  /** Gentle nudge back to the right role. */
  nudge: z.string().optional(),
});
const ContextFactSchema = z.object({
  label: z.string().min(1), // chip label
  value: z.string().min(1), // text folded into the assembled prompt
});
const DistractorSchema = z.object({
  label: z.string().min(1),
  /** Shown on tap — a privacy/relevance teaching moment; never selects. */
  warning: z.string().min(1),
});
const FormatToggleSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  recommended: z.boolean(),
});

export const TasteSimSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("taste"),
  xp: z.number().int().positive(),
  badge: z.string().min(1),
  intro: z.object({ copy: z.string().min(1), cta: z.string().min(1) }),
  role: z.object({
    promptBar: z.string().min(1), // e.g. "You are ___"
    copy: z.string().min(1),
    decisionBeat: z.string().min(1),
    options: z
      .array(RoleOptionSchema)
      .min(2)
      .refine((o) => o.some((x) => x.correct), "taste sim role needs a correct option"),
  }),
  context: z.object({
    promptBar: z.string().min(1),
    copy: z.string().min(1),
    minSelect: z.number().int().positive(),
    decisionBeat: z.string().min(1),
    facts: z.array(ContextFactSchema).min(1),
    distractors: z.array(DistractorSchema).default([]),
  }),
  format: z.object({
    promptBar: z.string().min(1),
    copy: z.string().min(1),
    decisionBeat: z.string().min(1),
    toggles: z.array(FormatToggleSchema).min(1),
  }),
  assembled: z.object({
    task: z.string().min(1), // the fixed [Task] line
    preface: z.string().min(1), // "You built this. Ready to watch it work?"
    cta: z.string().min(1), // "Generate my email"
  }),
  liveGen: z.object({
    /** Server builds the final prompt from the user's selections around this. */
    promptTemplate: z.string().min(1),
  }),
  /** Golden sample email — the scripted fallback on slow/error/quota. */
  fallbackOutput: z.string().min(1),
  celebration: z.object({ copy: z.string().min(1) }),
  grillBeat: GrillBeatSchema,
});
export type TasteSim = z.infer<typeof TasteSimSchema>;

// --- Parse helpers (used by content files + the seed script) ----------------
export const parseLesson = (data: unknown): Lesson => LessonSchema.parse(data);
export const parseRapidFire = (data: unknown): RapidFireItem => RapidFireItemSchema.parse(data);
export const parseSim = (data: unknown): SimScript => SimScriptSchema.parse(data);
export const parseTasteSim = (data: unknown): TasteSim => TasteSimSchema.parse(data);
