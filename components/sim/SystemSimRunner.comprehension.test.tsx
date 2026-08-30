import { afterEach, beforeAll, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SystemSimRunner } from "./SystemSimRunner";
import { SYSTEM_SIM } from "@/content/sims/system";

// FIX 3: tapping a node in the "Quick check" gives immediate feedback AT the tap
// point (the tapped node turns correct/green+✓ or incorrect/red) plus the inline
// insight/hint. Also covers FIX 4: the end grill is derived from THIS system's
// own edge cases (not the static onboarding one).

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeAll(() => {
  // jsdom has no scrollIntoView; the runner calls it on tap.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

const onboarding = SYSTEM_SIM.samples[0]; // default preset
const correctNode = onboarding.nodes.find((n) => n.id === onboarding.comprehension.correctNodeId)!;
const wrongNode = onboarding.nodes.find((n) => n.id === "n1")!; // "Offer accepted", not the answer

function gotoCheck() {
  render(<SystemSimRunner sim={SYSTEM_SIM} completeAction={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: SYSTEM_SIM.intro.cta })); // intro -> input
  fireEvent.click(screen.getByRole("button", { name: /generate the map/i })); // -> map
  fireEvent.click(screen.getByRole("button", { name: /trapdoors/i })); // -> edges
  fireEvent.click(screen.getByRole("button", { name: /quick check/i })); // -> check
}

describe("System X-Ray comprehension feedback (FIX 3)", () => {
  it("marks a wrong tap incorrect and shows the hint", () => {
    gotoCheck();
    const btn = screen.getByRole("button", { name: new RegExp(wrongNode.label, "i") });
    fireEvent.click(btn);
    expect(btn.className).toContain("incorrect");
    expect(screen.getByText(/not that one/i)).toBeInTheDocument();
  });

  it("marks the correct tap correct (with a ✓) and shows the insight", () => {
    gotoCheck();
    const btn = screen.getByRole("button", { name: new RegExp(correctNode.label, "i") });
    fireEvent.click(btn);
    expect(btn.className).toContain("correct");
    expect(btn.textContent).toContain("✓");
    expect(screen.getByText(new RegExp(onboarding.comprehension.insight.slice(0, 20), "i"))).toBeInTheDocument();
  });
});

describe("System X-Ray end grill is per-system (FIX 4)", () => {
  it("shows THIS system's most-severe edge case as the correct grill option", async () => {
    render(<SystemSimRunner sim={SYSTEM_SIM} completeAction={vi.fn(async () => ({
      ok: true as const, alreadyDone: false, xpAwarded: 120, leveledUp: false, newLevel: 2,
      streak: 1, streakAdvanced: false, badge: SYSTEM_SIM.badge,
    }))} />);
    fireEvent.click(screen.getByRole("button", { name: SYSTEM_SIM.intro.cta }));
    fireEvent.click(screen.getByRole("button", { name: /generate the map/i }));
    fireEvent.click(screen.getByRole("button", { name: /trapdoors/i }));
    fireEvent.click(screen.getByRole("button", { name: /quick check/i }));
    // answer correctly to unlock requirements
    fireEvent.click(screen.getByRole("button", { name: new RegExp(correctNode.label, "i") }));
    fireEvent.click(screen.getByRole("button", { name: /turn it into requirements/i }));
    fireEvent.click(screen.getByRole("button", { name: /finish & celebrate/i }));
    // The grill option must be onboarding's first edge case, NOT a static one.
    expect(
      await screen.findByRole("button", { name: new RegExp(onboarding.edgeCases[0].risk, "i") }),
    ).toBeInTheDocument();
    // And the retired static option must NOT appear.
    expect(screen.queryByRole("button", { name: /compliance gate/i })).not.toBeInTheDocument();
  });
});
