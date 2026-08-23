/**
 * North-star funnel event map (editable — plan §Analytics). One place so client
 * and server capture stay in sync and the funnel query is legible.
 *
 * North-star = signups who complete a FULL sim AND return on a separate day
 * within 7 days. `full_sim_completed` + `returned_separate_day` are the two
 * events that define it; taste completion is a separate leading indicator.
 */
export const EVENTS = {
  SIGNED_UP: "signed_up",
  SESSION_START: "session_start",
  ONBOARDING_COMPLETE: "onboarding_complete",
  LESSON_COMPLETED: "lesson_completed",
  RAPIDFIRE_COMPLETED: "rapidfire_completed",
  TASTE_SIM_COMPLETED: "taste_sim_completed", // leading indicator (not the north-star)
  FULL_SIM_COMPLETED: "full_sim_completed", // north-star numerator (part 1)
  RETURNED_SEPARATE_DAY: "returned_separate_day", // north-star numerator (part 2)
  STREAK_ADVANCED: "streak_advanced",
  LEVEL_UP: "level_up",
  REEL_VIEWED: "reel_viewed",
  REEL_LIKED: "reel_liked",
  REEL_SAVED: "reel_saved",
  REEL_SHARED: "reel_shared",
  REEL_REPORTED: "reel_reported",
  AI_FALLBACK_USED: "ai_fallback_used", // watch the fallback rate on free-tier quota
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
export type EventProps = Record<string, string | number | boolean | null>;
