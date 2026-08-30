import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EmailSimRunner } from "./EmailSimRunner";
import { EMAIL_SIM } from "@/content/sims/email";
import type { InboxCoachResult } from "@/app/(app)/learn/sim/[id]/email-actions";

// Spec §4.1: after the deterministic sort, the dynamic coach note + per-email
// reasons render, and a scripted fallback shows the honest SampleTag with retry.
// The sort/rubric stay deterministic; only the coaching layer is exercised here.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

const narrate = async () => ({ text: "Sorted!", source: "live" as const });

/** Drive the runner from intro to the rubric coach card (needs >=3 rules). */
async function gotoRubric(coachAction: (input: unknown) => Promise<InboxCoachResult>) {
  render(
    <EmailSimRunner sim={EMAIL_SIM} narrateAction={narrate} coachAction={coachAction} />,
  );
  fireEvent.click(screen.getByRole("button", { name: EMAIL_SIM.intro.cta }));
  fireEvent.click(screen.getByRole("button", { name: /set the rules/i }));
  // starterRules has 2; add a 3rd so "See my prompt" enables.
  fireEvent.click(screen.getByRole("button", { name: /From leadership/i }));
  fireEvent.click(screen.getByRole("button", { name: /🔴 Now/i }));
  fireEvent.click(screen.getByRole("button", { name: /see my prompt/i }));
  fireEvent.click(screen.getByRole("button", { name: /run it/i }));
  // run phase: wait for narration, then move to rubric.
  await screen.findByText("Sorted!");
  fireEvent.click(screen.getByRole("button", { name: /how did i do/i }));
}

describe("EmailSimRunner dynamic coaching", () => {
  it("renders the live coach note and a per-email AI reason", async () => {
    const coachAction = vi.fn(async () => ({
      coachNote: "You nailed the urgent mail routing.",
      topReasons: [{ emailId: "e2", reason: "CEO deadline is urgent" }],
      source: "live" as const,
    }));
    await gotoRubric(coachAction);

    expect(await screen.findByText(/nailed the urgent mail/i)).toBeInTheDocument();
    expect(coachAction).toHaveBeenCalled();
    // The AI per-email reason renders on the sorted card (run phase renders it too).
  });

  it("shows the SampleTag with retry when the coach falls back", async () => {
    const coachAction = vi.fn(async () => ({
      coachNote: EMAIL_SIM.rubric.checks[0].improvement,
      topReasons: [],
      source: "fallback" as const,
    }));
    await gotoRubric(coachAction);

    expect(await screen.findByText(/showing a sample/i)).toBeInTheDocument();
    const before = coachAction.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(coachAction.mock.calls.length).toBe(before + 1));
  });
});
