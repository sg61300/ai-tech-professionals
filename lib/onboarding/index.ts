import { z } from "zod";

/**
 * Onboarding domain logic. Pure + typed so the resume gate and the server-action
 * input validation are TDD'd and shared by the route + action.
 *
 * Screen set follows the LOCKED compressed mockup (ADR-013 / Design/activation-
 * spine.html §3 "~4 taps"), which supersedes the older 7-screen PRD/13 copy:
 *   1. Profession, only "hr" selectable; others capture "notify me" demand.
 *   2. Avatar, 8 presets + name (required) + avatar_name/mobile (optional).
 *   3. Level (merged, progressive focus), role seniority + AI comfort, both
 *      free-select self-reports (MVP has one L1 path; these flavor + inform).
 */

// --- Avatars (key + gradient tile, mirrored from the mockup) -----------------
export const AVATARS = [
  { key: "fox", gradient: "linear-gradient(135deg,#0D9488,#8B5CF6)" },
  { key: "panda", gradient: "linear-gradient(135deg,#F59E0B,#FB6F5A)" },
  { key: "owl", gradient: "linear-gradient(135deg,#8B5CF6,#22C9BD)" },
  { key: "koala", gradient: "linear-gradient(135deg,#FB6F5A,#8B5CF6)" },
  { key: "turtle", gradient: "linear-gradient(135deg,#22C55E,#0D9488)" },
  { key: "penguin", gradient: "linear-gradient(135deg,#5b8fe0,#a5e8ff)" },
  { key: "lion", gradient: "linear-gradient(135deg,#F59E0B,#22C9BD)" },
  { key: "octopus", gradient: "linear-gradient(135deg,#8B5CF6,#FB6F5A)" },
] as const;
export const AVATAR_KEYS = AVATARS.map((a) => a.key) as [string, ...string[]];

// --- Profession (only HR live in MVP) ---------------------------------------
export const PROFESSION_OPTIONS = [
  { value: "hr", emoji: "🧑‍💼", label: "Human Resources", note: "Ready now", locked: false },
  { value: "finance", emoji: "💰", label: "Finance", locked: true },
  { value: "marketing", emoji: "📣", label: "Marketing", locked: true },
  { value: "operations", emoji: "⚙️", label: "Operations", locked: true },
] as const;

// --- Merged level screen: role seniority + AI comfort -----------------------
export const SENIORITY_OPTIONS = [
  { value: "entry", label: "Entry", sub: "0–2 yrs" },
  { value: "mid", label: "Mid", sub: "3–7 yrs" },
  { value: "senior", label: "Senior", sub: "8+ yrs" },
] as const;
export const SENIORITY_VALUES = SENIORITY_OPTIONS.map((o) => o.value) as [string, ...string[]];

/**
 * AI proficiency (PRD/13 Screen 6 semantics, kept inside the compressed merged
 * screen): only Level 1 is selectable in MVP; L2/L3 are locked and open a
 * "Your AI Partner is Coming Soon" preview instead of selecting.
 */
export const AI_LEVEL_OPTIONS = [
  { value: "l1", emoji: "🐣", label: "Level 1", sub: "Novice but keen", locked: false },
  { value: "l2", emoji: "⚡", label: "Level 2", sub: "Fantastic", locked: true },
  { value: "l3", emoji: "🚀", label: "Level 3", sub: "Awesome", locked: true },
] as const;

/** Locked-level previews (PRD/12) shown on the "coming soon" screen. */
export const LEVEL_PREVIEWS = {
  l2: {
    badge: "Level 2 · Fantastic",
    tagline: "Make AI run your week, quietly automate the boring 30%.",
    promise:
      "You know how to talk to AI. Level 2 is where you make it run your week, onboarding, performance, payroll queries, data. Less “drafting emails”, more “quietly automating the boring 30%.”",
    units: [
      "Automate the HR calendar, onboarding kits, offboarding checklists, leave & payroll assistants.",
      "HR meets data, read an attrition sheet, turn surveys into themes, draft a PMS summary.",
      "Better comms machinery, policy explainers that scale, compliance that isn't a snooze.",
    ],
    capstone: "Simulation: “Build your onboarding autopilot”, chain steps into one workflow.",
  },
  l3: {
    badge: "Level 3 · Awesome",
    tagline: "The black belt, design AI systems, not just use them.",
    promise:
      "Level 3 is the black belt. You'll understand how AI systems are wired, build your own little agents, and walk into a vendor meeting able to say exactly what you need, and why. HR as architect, not audience.",
    units: [
      "Build a tiny agent, your own note-taker, a bot that answers repeat HR queries.",
      "Think in systems, how data flows through an HRMS, APIs in plain English.",
      "HR as decision-maker, turn a process into a vendor brief, make the buy/build call.",
    ],
    capstone: "Simulation: “From idea to vendor brief”, design a tool spec good enough to hand a vendor.",
  },
} as const;
export type LockedLevel = keyof typeof LEVEL_PREVIEWS;

// --- How-it-works intro cards (PRD/13 resolved-decision #1, kept) ------------
export const INTRO_CARDS = [
  { emoji: "📚", md: "**Learn** in 5-minute lessons that end in a real win." },
  { emoji: "🛠️", md: "**Practice** on real HR tasks in gamified simulations." },
  { emoji: "🔥", md: "**Level up**, build streaks, earn XP, become the AI person on your team." },
] as const;

// --- Steps + resume logic ---------------------------------------------------
export const ONBOARDING_STEPS = [
  "intro",
  "profession",
  "profile",
  "level",
  "building",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingProfile = {
  profession: string | null;
  name: string | null;
  avatar_key: string | null;
  seniority: string | null;
  ai_proficiency: string | null;
  onboarding_complete: boolean;
};

/**
 * The step a user should resume at, or null if onboarding is already complete.
 * A brand-new profile (nothing touched) starts at the intro; once any field is
 * set the intro is behind them, so we jump straight to the first data gap.
 */
export function firstUnfinishedStep(p: OnboardingProfile): OnboardingStep | null {
  if (p.onboarding_complete) return null;

  const untouched =
    !p.profession && !p.name && !p.avatar_key && !p.seniority && !p.ai_proficiency;
  if (untouched) return "intro";

  if (!p.profession) return "profession";
  if (!p.name || !p.avatar_key) return "profile";
  if (!p.seniority || !p.ai_proficiency) return "level";
  return "building";
}

// --- Server-action input validation -----------------------------------------
const nonBlank = z.string().trim().min(1);

/**
 * A partial profile patch written after each onboarding step (incremental save
 * = free resume). Every field optional; enums enforce MVP selectability so a
 * tampered client cannot persist a locked profession.
 */
export const OnboardingPatchSchema = z.object({
  name: nonBlank.max(40).optional(),
  avatar_name: nonBlank.max(30).nullish(),
  mobile: z.string().trim().max(20).nullish(),
  avatar_key: z.enum(AVATAR_KEYS).optional(),
  profession: z.literal("hr").optional(),
  seniority: z.enum(SENIORITY_VALUES).optional(),
  // Only Level 1 is selectable in MVP; L2/L3 open a "coming soon" preview.
  ai_proficiency: z.literal("l1").optional(),
  timezone: nonBlank.max(64).optional(),
  onboarding_complete: z.boolean().optional(),
});
export type OnboardingPatch = z.infer<typeof OnboardingPatchSchema>;
