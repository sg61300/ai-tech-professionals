import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SystemSimRunner } from "./SystemSimRunner";
import { SYSTEM_SIM } from "@/content/sims/system";
import type { SysSample } from "@/content/schema";
import type { XrayGenResult } from "@/app/(app)/learn/sim/[id]/system-actions";

// Spec §4.2b: the guarded free-text seam blocks obvious identifiers client-side,
// a valid submit renders a generated map through the EXISTING flow renderer, and
// a fallback renders the honest SampleTag + closest preset.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

const generatedSample: SysSample = {
  id: "generated",
  label: "Offboarding X-ray",
  nodes: [
    { id: "n1", label: "Resignation submitted", kind: "start", hr: false, hint: "Clock starts." },
    { id: "n2", label: "Manager approves", kind: "decision", hr: false, hint: "Coverage." },
    { id: "n3", label: "HR runs clearance", kind: "hr", hr: true, hint: "HR owns exit." },
    { id: "n4", label: "Final settlement", kind: "step", hr: false, hint: "Payroll closes." },
  ],
  edges: [
    { from: "n1", to: "n2" },
    { from: "n2", to: "n3", label: "Approved" },
    { from: "n3", to: "n4" },
  ],
  edgeCases: [
    { risk: "Clearance skipped", why: "Access never revoked." },
    { risk: "Settlement delayed", why: "Legal exposure." },
  ],
  requirements: ["Track clearance", "Block settlement until clearance", "Audit approvals"],
  comprehension: { prompt: "Tap HR step.", correctNodeId: "n3", insight: "HR owns exit.", hint: "Who decides?" },
  mermaid: "flowchart TD\n  n1[Resignation submitted]",
};

function openDescribe(generateAction: (i: unknown) => Promise<XrayGenResult>) {
  render(<SystemSimRunner sim={SYSTEM_SIM} generateAction={generateAction} completeAction={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: SYSTEM_SIM.intro.cta })); // intro -> input
  fireEvent.click(screen.getByRole("button", { name: /describe your own/i }));
}

describe("SystemSimRunner describe-your-own", () => {
  it("blocks an obvious identifier client-side and keeps generate disabled", () => {
    const gen = vi.fn();
    openDescribe(gen);
    const box = screen.getByLabelText(/what kind of hr workflow/i);
    fireEvent.change(box, { target: { value: "email me at priya@acme.com" } });
    expect(screen.getByText(/email or handle/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate my map/i })).toBeDisabled();
    expect(gen).not.toHaveBeenCalled();
  });

  it("requires attestation before enabling generate, then renders the generated map", async () => {
    const gen = vi.fn(async () => ({ sample: generatedSample, source: "live" as const }));
    openDescribe(gen);
    fireEvent.change(screen.getByLabelText(/what kind of hr workflow/i), {
      target: { value: "employee offboarding" },
    });
    // Valid text but not attested → still disabled.
    expect(screen.getByRole("button", { name: /generate my map/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /generate my map/i }));
    expect(gen).toHaveBeenCalledWith({ workflowType: "employee offboarding" });
    expect(await screen.findByText("Resignation submitted")).toBeInTheDocument();
    expect(screen.getByText("HR runs clearance")).toBeInTheDocument();
  });

  it("shows the SampleTag and closest-preset note on a fallback", async () => {
    const preset = SYSTEM_SIM.samples[0];
    const gen = vi.fn(async () => ({ sample: preset, source: "fallback" as const }));
    openDescribe(gen);
    fireEvent.change(screen.getByLabelText(/what kind of hr workflow/i), {
      target: { value: "some workflow" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /generate my map/i }));
    expect(await screen.findByText(/showing a sample/i)).toBeInTheDocument();
    expect(screen.getByText(/closest sample system/i)).toBeInTheDocument();
  });
});
