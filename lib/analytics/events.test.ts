import { describe, it, expect } from "vitest";
import { EVENTS } from "./events";

/**
 * The event map is the contract between capture sites and the PostHog metrics
 * (Architecture/12). A duplicated value or a missing engagement event silently
 * breaks a metric with no type error, so guard it here.
 */
describe("EVENTS map", () => {
  it("has no duplicate event names", () => {
    const values = Object.values(EVENTS);
    expect(new Set(values).size).toBe(values.length);
  });

  it("uses snake_case string names", () => {
    for (const v of Object.values(EVENTS)) {
      expect(v).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("includes the Architecture/12 engagement + demand events", () => {
    expect(EVENTS.ARTICLES_TAB_OPENED).toBe("articles_tab_opened"); // #4
    expect(EVENTS.LOCKED_LEVEL_TAPPED).toBe("locked_level_tapped"); // #8
    expect(EVENTS.PROFESSION_INTEREST).toBe("profession_interest"); // #9a
    expect(EVENTS.PROFILE_EDIT_SAVED).toBe("profile_edit_saved"); // #9b
    expect(EVENTS.THEME_SET).toBe("theme_set"); // #10
    expect(EVENTS.REELS_OPENED).toBe("reels_opened"); // #11 denominator
    expect(EVENTS.REELS_SCREEN_TIME).toBe("reels_screen_time"); // #11 numerator input
  });

  it("includes the XP-unlock sim events", () => {
    expect(EVENTS.SIM_UNLOCKED_VIA_XP).toBe("sim_unlocked_via_xp"); // headline secondary
    expect(EVENTS.SIM_OPENED).toBe("sim_opened"); // supporting reach metric
  });

  it("keeps the north-star + funnel events intact", () => {
    expect(EVENTS.TASTE_SIM_COMPLETED).toBe("taste_sim_completed"); // #1a/#1b
    expect(EVENTS.FULL_SIM_COMPLETED).toBe("full_sim_completed"); // NS part 1
    expect(EVENTS.RETURNED_SEPARATE_DAY).toBe("returned_separate_day"); // NS part 2 / #1b
  });
});
