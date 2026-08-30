import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TasteSimRunner } from "./TasteSimRunner";
import { TASTE_SIM } from "@/content/sims/taste";

// Regression: on the Context step, tapping a distractor chip ("wrong prompt")
// shows a ⚠️ warning. That warning must CLEAR once the learner taps a valid
// fact chip. Before the fix, `distractorWarn` was set but never reset, so the
// warning stuck on screen even after selecting correct facts.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

const WARN = TASTE_SIM.context.distractors[0].warning; // "Personal and confidential..."

function gotoContextStep() {
  render(<TasteSimRunner sim={TASTE_SIM} />);
  fireEvent.click(screen.getByRole("button", { name: TASTE_SIM.intro.cta })); // intro -> role
  fireEvent.click(
    screen.getByRole("button", { name: TASTE_SIM.role.options[0].label }), // pick correct role
  );
  fireEvent.click(screen.getByRole("button", { name: /add the context/i })); // role -> context
}

describe("TasteSimRunner context distractor warning", () => {
  it("clears the distractor warning after a valid fact is selected", () => {
    gotoContextStep();

    // Tap a distractor -> warning appears.
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(TASTE_SIM.context.distractors[0].label, "i") }),
    );
    expect(screen.getByText(new RegExp(WARN, "i"))).toBeInTheDocument();

    // Tap a valid fact -> warning must clear.
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(TASTE_SIM.context.facts[0].label, "i") }),
    );
    expect(screen.queryByText(new RegExp(WARN, "i"))).not.toBeInTheDocument();
  });
});
