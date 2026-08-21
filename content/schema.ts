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
  branches: z
    .array(z.object({ choice: z.string().min(1), retort: z.string().min(1) }))
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

// --- Parse helpers (used by content files + the seed script) ----------------
export const parseLesson = (data: unknown): Lesson => LessonSchema.parse(data);
export const parseRapidFire = (data: unknown): RapidFireItem => RapidFireItemSchema.parse(data);
export const parseSim = (data: unknown): SimScript => SimScriptSchema.parse(data);
