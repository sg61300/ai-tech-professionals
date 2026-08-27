import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OnboardingFlow } from "./OnboardingFlow";

// Regression: finishing onboarding must trigger EXACTLY ONE navigation to /learn.
// The server action (saveOnboarding) already drives a redirect to /learn via the
// /onboarding page; a second manual window.location.assign("/learn") produced a
// double loader ("loader appeared twice"). This test locks the single-nav contract.

afterEach(cleanup);

function mockLocationAssign() {
  const assign = vi.fn();
  Object.defineProperty(window, "location", {
    value: { ...window.location, assign },
    writable: true,
    configurable: true,
  });
  return assign;
}

describe("OnboardingFlow finish (double-loader regression)", () => {
  it("does NOT manually hard-navigate after completing onboarding (server redirect drives it)", async () => {
    const assign = mockLocationAssign();
    const saveAction = vi.fn(async () => ({ ok: true as const }));

    render(
      <OnboardingFlow
        startStep="level"
        saveAction={saveAction}
        alreadyReferred={false}
        initial={{
          name: "Test",
          avatarName: "",
          mobile: "",
          avatarKey: null,
          seniority: "entry",
          aiComfort: "l1", // levelPhase === 3 → "Start Lesson 1" is enabled
        }}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /start lesson 1/i }));
    });

    // After the level save + the "building" beat, the first-signup referral prompt
    // appears (user was not referred via a link).
    const skip = await screen.findByRole(
      "button",
      { name: /i don't have one/i },
      { timeout: 4000 },
    );
    await act(async () => {
      fireEvent.click(skip);
    });

    // The completion save fires with onboarding_complete...
    await waitFor(() =>
      expect(saveAction).toHaveBeenCalledWith(
        expect.objectContaining({ onboarding_complete: true }),
      ),
    );

    // ...but the component must NOT also hard-navigate — that second navigation was
    // the double loader. The server-driven redirect (untested here) carries the user.
    expect(assign).not.toHaveBeenCalled();
  });
});
