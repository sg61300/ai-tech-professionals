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
  STREAK_SAVED: "streak_saved", // spent XP to keep a streak after a 1–2 day gap
  LEVEL_UP: "level_up",
  REEL_VIEWED: "reel_viewed",
  REEL_LIKED: "reel_liked",
  REEL_SAVED: "reel_saved",
  REEL_SHARED: "reel_shared",
  REEL_REPORTED: "reel_reported",
  AI_FALLBACK_USED: "ai_fallback_used", // watch the fallback rate on free-tier quota
  // Engagement / demand signals (Architecture/12 v2). All fire server-side via
  // captureServer(user.id, …) so they share the funnel's distinct-id space.
  ARTICLES_TAB_OPENED: "articles_tab_opened", // metric #4 — Articles demand
  LOCKED_LEVEL_TAPPED: "locked_level_tapped", // metric #8 — L2/L3 curiosity {level, surface}
  PROFESSION_INTEREST: "profession_interest", // metric #9a — tapped a locked (other) profession {profession, surface}
  PROFILE_EDIT_SAVED: "profile_edit_saved", // metric #9b — committed a seniority change {field}
  THEME_SET: "theme_set", // metric #10 — dark-mode preference {theme} (+ $set preferred_theme)
  REELS_OPENED: "reels_opened", // metric #11 — opened the reels screen (denominator)
  REELS_SCREEN_TIME: "reels_screen_time", // metric #11 — visible seconds on the reels screen per visit {seconds}
  SIM_UNLOCKED_VIA_XP: "sim_unlocked_via_xp", // headline secondary — spent XP to unlock a sim ahead of the path {sim_id, xp_spent, ahead_of_path}
  SIM_OPENED: "sim_opened", // supporting reach metric — opened a sim {sim_id, via: "path" | "xp"}
  // Referral (AARRR Referral stage — ADR-020 / Session 21). All server-side.
  REFERRAL_LINK_SHARED: "referral_link_shared", // referrer tapped a share channel {channel}
  REFERRAL_CODE_APPLIED: "referral_code_applied", // invitee applied a code {via} (signup | profile)
  REFERRAL_REWARD_GRANTED: "referral_reward_granted", // invitee activated → both sides paid {xp_each}
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
export type EventProps = Record<string, string | number | boolean | null>;
