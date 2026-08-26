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

// --- Seniority flavoring (settled decision: "org seniority only flavors
// examples") --------------------------------------------------------------
// The org-seniority a learner picked in onboarding. Lessons may carry an
// OPTIONAL per-seniority example line (`flavor`) that the runner shows as an
// extra "for your level" note. It is purely additive: absent → nothing shown,
// so the path is identical for everyone regardless of seniority. Authoring is
// light (only a few lessons carry variants for MVP); the selector lives in
// `lib/flavor`.
export const SENIORITIES = ["entry", "mid", "senior"] as const;
export const SenioritySchema = z.enum(SENIORITIES);
export type Seniority = z.infer<typeof SenioritySchema>;

// Each key optional so a lesson can flavor for one, some, or all levels.
export const FlavorSchema = z
  .object({
    entry: z.string().min(1),
    mid: z.string().min(1),
    senior: z.string().min(1),
  })
  .partial();
export type Flavor = z.infer<typeof FlavorSchema>;

// --- Lesson -----------------------------------------------------------------
export const LessonSchema = z.object({
  id: z.string().min(1),
  unit: z.number().int().positive(),
  title: z.string().min(1),
  blocks: z.array(BlockSchema).min(1),
  exercise: ExerciseSchema,
  grillBeat: GrillBeatSchema.optional(),
  /** Optional per-seniority example line (see FlavorSchema). */
  flavor: FlavorSchema.optional(),
});
export type Lesson = z.infer<typeof LessonSchema>;

// --- Rapid-fire -------------------------------------------------------------
export const RapidFireItemSchema = z
  .object({
    id: z.string().min(1),
    /** mcq | truefalse | pickbetter — drives how the runner renders options. */
    kind: z.enum(["mcq", "truefalse", "pickbetter"]).default("mcq"),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    correct: z.number().int().nonnegative(), // index into options
    /** Mandatory 1-line teach shown after answering (PRD/11: learning > scoring). */
    teach: z.string().min(1),
    grillStyle: z.string().optional(),
  })
  .refine((q) => q.correct < q.options.length, {
    message: "rapid-fire correct index out of range",
    path: ["correct"],
  });
export type RapidFireItem = z.infer<typeof RapidFireItemSchema>;

export const RapidFireSetSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  intro: z.string().min(1),
  /** Correct answers needed to pass (default 6/8). */
  passThreshold: z.number().int().positive().default(6),
  /** The sim node this round unlocks on pass (spine id), if any. */
  unlocksSimId: z.string().optional(),
  items: z.array(RapidFireItemSchema).min(1),
});
export type RapidFireSet = z.infer<typeof RapidFireSetSchema>;

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

// --- Email sim (PRD/09, "Inbox Tamer") --------------------------------------
// The first FULL sim (north-star). A visual rule-builder (IF condition THEN
// bucket) that compiles into an AI prompt; deterministic rule-based sort is the
// source of truth (correct by construction + never breaks), with a live-AI
// reason pass layered on top. Bespoke shape like TasteSim.
export const EMAIL_BUCKETS = ["now", "today", "week", "later"] as const;
export const EmailBucketKey = z.enum(EMAIL_BUCKETS);

const EmailBucketSchema = z.object({
  key: EmailBucketKey,
  label: z.string().min(1),
  emoji: z.string().min(1),
  blurb: z.string().min(1),
});
const InboxEmailSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  fromType: z.string().min(1), // e.g. "employee" | "leadership" | "vendor"
  subject: z.string().min(1),
  /** Tags a condition can match on (e.g. "exit", "newsletter", "spam"). */
  tags: z.array(z.string().min(1)).min(1),
  /** The correct bucket (the scripted golden sort / fallback). */
  goldenBucket: EmailBucketKey,
});
const ConditionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1), // chip text, e.g. "Mentions resignation / exit"
  /** An email matches this condition when it carries this tag. */
  matchTag: z.string().min(1),
});
const EmailRuleSchema = z.object({
  conditionId: z.string().min(1),
  bucketKey: EmailBucketKey,
});
const RubricCheckSchema = z.object({
  /** Engine-known id: exits_urgent | leadership_separated | noise_filtered | all_matched. */
  id: z.enum(["exits_urgent", "leadership_separated", "noise_filtered", "all_matched"]),
  label: z.string().min(1),
  /** Shown as the "one improvement" when THIS check is the first that fails. */
  improvement: z.string().min(1),
});
const SetupPathSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1),
  note: z.string().optional(),
});

export const EmailSimSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("email"),
  xp: z.number().int().positive(),
  badge: z.string().min(1),
  intro: z.object({ copy: z.string().min(1), cta: z.string().min(1) }),
  inboxIntro: z.string().min(1),
  buckets: z.array(EmailBucketSchema).length(4),
  inbox: z.array(InboxEmailSchema).min(1),
  conditions: z.array(ConditionSchema).min(2),
  /** Pre-suggested worked-example rules (the "existing solution" scaffold). */
  starterRules: z.array(EmailRuleSchema).default([]),
  decisionBeat: z.string().min(1), // after the first self-added rule
  /** `{rules}` is replaced with the compiled rule lines. */
  compiledPromptTemplate: z.string().min(1),
  compiledPromptCopy: z.string().min(1),
  rubric: z.object({
    checks: z.array(RubricCheckSchema).min(1),
    allClearNote: z.string().min(1), // shown when nothing to improve
  }),
  tweakCopy: z.string().min(1),
  tweakDecisionBeat: z.string().min(1),
  setup: z.object({
    copy: z.string().min(1),
    safety: z.string().min(1),
    paths: z.array(SetupPathSchema).min(1),
  }),
  celebration: z.object({ copy: z.string().min(1) }),
  grillBeat: GrillBeatSchema,
});
export type EmailSim = z.infer<typeof EmailSimSchema>;
export type EmailBucket = z.infer<typeof EmailBucketKey>;
export type InboxEmail = z.infer<typeof InboxEmailSchema>;
export type EmailRule = z.infer<typeof EmailRuleSchema>;
export type EmailCondition = z.infer<typeof ConditionSchema>;

// --- System-explainer sim (PRD/10, "System X-Ray") --------------------------
// A multimodal "understand any HR system" sim. MVP ships preset sample systems
// (the reliable golden path — PRD says presets "so the sim always works"); live
// text/image generation into the graph is a documented post-MVP seam. Rendered
// from a typed node/edge graph (tappable, HR-glow) rather than raw Mermaid.
export const SYS_NODE_KINDS = ["start", "step", "decision", "hr", "it", "end"] as const;

const SysNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(SYS_NODE_KINDS),
  /** Plain-English card shown when the node is tapped. */
  hint: z.string().min(1),
  /** HR-owned step → glows + "HR owns this" badge. */
  hr: z.boolean().default(false),
  /** Decision-beat shown on an HR node (optional). */
  decisionBeat: z.string().optional(),
});
const SysEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().optional(), // e.g. "Pass" / "Fail" on a decision branch
});
const SysEdgeCaseSchema = z.object({
  risk: z.string().min(1),
  why: z.string().min(1),
});
const SysSampleSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    nodes: z.array(SysNodeSchema).min(2),
    edges: z.array(SysEdgeSchema).min(1),
    edgeCases: z.array(SysEdgeCaseSchema).min(1),
    requirements: z.array(z.string().min(1)).min(1),
    comprehension: z.object({
      prompt: z.string().min(1),
      correctNodeId: z.string().min(1),
      insight: z.string().min(1),
      hint: z.string().min(1),
    }),
    /** Mermaid text kept for the copy-able artifact / future rendering. */
    mermaid: z.string().min(1),
  })
  .refine((s) => s.nodes.some((n) => n.id === s.comprehension.correctNodeId), {
    message: "comprehension.correctNodeId must reference a node",
    path: ["comprehension", "correctNodeId"],
  });

export const SystemSimSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("system"),
  xp: z.number().int().positive(),
  badge: z.string().min(1),
  intro: z.object({ copy: z.string().min(1), cta: z.string().min(1) }),
  safety: z.string().min(1),
  inputCopy: z.string().min(1),
  samples: z.array(SysSampleSchema).min(1),
  edgeCasesCopy: z.string().min(1),
  requirementsCopy: z.string().min(1),
  requirementsBanner: z.string().min(1),
  celebration: z.object({ copy: z.string().min(1) }),
  grillBeat: GrillBeatSchema,
});
export type SystemSim = z.infer<typeof SystemSimSchema>;
export type SysNode = z.infer<typeof SysNodeSchema>;
export type SysEdge = z.infer<typeof SysEdgeSchema>;
export type SysSample = z.infer<typeof SysSampleSchema>;

// --- Parse helpers (used by content files + the seed script) ----------------
export const parseLesson = (data: unknown): Lesson => LessonSchema.parse(data);
export const parseRapidFire = (data: unknown): RapidFireItem => RapidFireItemSchema.parse(data);
export const parseRapidFireSet = (data: unknown): RapidFireSet => RapidFireSetSchema.parse(data);
export const parseSim = (data: unknown): SimScript => SimScriptSchema.parse(data);
export const parseEmailSim = (data: unknown): EmailSim => EmailSimSchema.parse(data);
export const parseSystemSim = (data: unknown): SystemSim => SystemSimSchema.parse(data);
export const parseTasteSim = (data: unknown): TasteSim => TasteSimSchema.parse(data);
