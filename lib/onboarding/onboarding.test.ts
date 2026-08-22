import { describe, expect, it } from "vitest";
import {
  firstUnfinishedStep,
  OnboardingPatchSchema,
  type OnboardingProfile,
} from "./index";

const blank: OnboardingProfile = {
  profession: null,
  name: null,
  avatar_key: null,
  seniority: null,
  ai_proficiency: null,
  onboarding_complete: false,
};

describe("firstUnfinishedStep (resume logic)", () => {
  it("sends a brand-new user to the intro", () => {
    expect(firstUnfinishedStep(blank)).toBe("intro");
  });

  it("returns null once onboarding is complete", () => {
    expect(firstUnfinishedStep({ ...blank, onboarding_complete: true })).toBeNull();
  });

  it("resumes at profession when only intro was seen", () => {
    // Any single field set means they got past the intro; jump to first gap.
    expect(firstUnfinishedStep({ ...blank, seniority: "mid" })).toBe("profession");
  });

  it("resumes at profile when profession is chosen but name is missing", () => {
    expect(firstUnfinishedStep({ ...blank, profession: "hr" })).toBe("profile");
  });

  it("resumes at level when profile is done but seniority/comfort are missing", () => {
    expect(
      firstUnfinishedStep({ ...blank, profession: "hr", name: "Aya", avatar_key: "fox" }),
    ).toBe("level");
  });

  it("stays on level when only ai comfort is missing", () => {
    expect(
      firstUnfinishedStep({
        ...blank,
        profession: "hr",
        name: "Aya",
        avatar_key: "fox",
        seniority: "mid",
      }),
    ).toBe("level");
  });

  it("lands on building when every field is set but not yet marked complete", () => {
    expect(
      firstUnfinishedStep({
        profession: "hr",
        name: "Aya",
        avatar_key: "fox",
        seniority: "mid",
        ai_proficiency: "l1",
        onboarding_complete: false,
      }),
    ).toBe("building");
  });
});

describe("OnboardingPatchSchema", () => {
  it("accepts a valid final patch", () => {
    const patch = OnboardingPatchSchema.parse({
      name: "Aya",
      avatar_key: "fox",
      seniority: "mid",
      ai_proficiency: "l1",
      timezone: "Asia/Kolkata",
      onboarding_complete: true,
    });
    expect(patch.name).toBe("Aya");
  });

  it("trims and rejects a blank name", () => {
    expect(() => OnboardingPatchSchema.parse({ name: "   " })).toThrow();
  });

  it("rejects an unknown avatar key", () => {
    expect(() => OnboardingPatchSchema.parse({ avatar_key: "dragon" })).toThrow();
  });

  it("rejects a locked profession (only hr is selectable in MVP)", () => {
    expect(() => OnboardingPatchSchema.parse({ profession: "finance" })).toThrow();
  });

  it("rejects a locked proficiency (only l1 is selectable in MVP)", () => {
    expect(() => OnboardingPatchSchema.parse({ ai_proficiency: "l2" })).toThrow();
  });

  it("accepts an empty optional avatar_name and mobile as null", () => {
    const patch = OnboardingPatchSchema.parse({ avatar_name: null, mobile: null });
    expect(patch.avatar_name).toBeNull();
  });
});
