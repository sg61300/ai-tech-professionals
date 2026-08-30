import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BiasSimRunner } from "./BiasSimRunner";
import { BIAS_SIM } from "@/content/sims/bias";
import type { ScreenResult } from "@/app/(app)/learn/sim/[id]/bias-actions";

// Spec §4.3: the capstone before/after. AI ranks (naive) -> learner audits the
// biased reasons -> fixes the prompt -> AI re-ranks fairer, and the order VISIBLY
// changes. A fallback shows the honest SampleTag.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

/** Live stub: naive ranking first (no fixes), fair ranking once fixes are sent. */
const liveScreen = vi.fn(async (input: unknown): Promise<ScreenResult> => {
  const fixes = (input as { fixToggleIds?: string[] }).fixToggleIds ?? [];
  return fixes.length > 0
    ? { ranking: BIAS_SIM.goldenFair, source: "live" }
    : { ranking: BIAS_SIM.goldenBiased, source: "live" };
});

const biasedLabels = BIAS_SIM.auditReasons.filter((r) => r.biased).map((r) => r.label);
const debiasingLabels = BIAS_SIM.fixToggles.filter((t) => t.debiasing).map((t) => t.label);

async function driveToRound2(screenAction: typeof liveScreen) {
  render(<BiasSimRunner sim={BIAS_SIM} screenAction={screenAction} completeAction={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /screen the stack/i })); // intro -> stack
  fireEvent.click(screen.getByRole("button", { name: /let ai rank them/i })); // -> round1
  await screen.findByText(BIAS_SIM.round1Copy);
  fireEvent.click(screen.getByRole("button", { name: /check its reasons/i })); // -> audit
  for (const label of biasedLabels) {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(label, "i") }));
  }
  fireEvent.click(screen.getByRole("button", { name: /now fix the prompt/i })); // -> fix
  for (const label of debiasingLabels) {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }));
  }
  fireEvent.click(screen.getByRole("button", { name: /re-rank with the fair prompt/i })); // -> round2
}

describe("BiasSimRunner before/after", () => {
  it("re-ranks fairer and shows the visible movement (a strong candidate rises)", async () => {
    await driveToRound2(liveScreen);
    await screen.findByText(BIAS_SIM.round2Copy);
    // Meera (c3): biased rank 6 -> fair rank 3, so she moved up 3 places.
    expect(screen.getByText(/▲ 3/)).toBeInTheDocument();
    expect(liveScreen).toHaveBeenCalledTimes(2);
    // The second call carried the selected fix toggles.
    const secondArg = liveScreen.mock.calls[1][0] as { fixToggleIds?: string[] };
    expect(secondArg.fixToggleIds && secondArg.fixToggleIds.length).toBeGreaterThan(0);
  });

  it("shows the SampleTag when a ranking call falls back", async () => {
    const fallbackScreen = vi.fn(async () => ({ ranking: BIAS_SIM.goldenBiased, source: "fallback" as const }));
    render(<BiasSimRunner sim={BIAS_SIM} screenAction={fallbackScreen} completeAction={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /screen the stack/i }));
    fireEvent.click(screen.getByRole("button", { name: /let ai rank them/i }));
    expect(await screen.findByText(/showing a sample/i)).toBeInTheDocument();
  });

  it("blocks the audit until exactly the biased reasons are flagged", async () => {
    render(<BiasSimRunner sim={BIAS_SIM} screenAction={liveScreen} completeAction={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /screen the stack/i }));
    fireEvent.click(screen.getByRole("button", { name: /let ai rank them/i }));
    await screen.findByText(BIAS_SIM.round1Copy);
    fireEvent.click(screen.getByRole("button", { name: /check its reasons/i }));
    // Flag only ONE biased reason -> not enough, so "Now fix the prompt" is not shown yet.
    fireEvent.click(screen.getByRole("button", { name: new RegExp(biasedLabels[0], "i") }));
    fireEvent.click(screen.getByRole("button", { name: /check my flags/i }));
    expect(screen.getByText(/not quite/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /now fix the prompt/i })).not.toBeInTheDocument();
  });
});
