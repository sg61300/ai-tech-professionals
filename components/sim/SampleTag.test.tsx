import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SampleTag } from "./SampleTag";

afterEach(cleanup);

// The honest "sample" pill (spec §3.4): shown whenever an AI result is a scripted
// fallback, never passed off as live. Offers a Retry that re-fires the call.

describe("SampleTag", () => {
  it("shows the sample copy and a retry control", () => {
    render(<SampleTag onRetry={() => {}} />);
    expect(screen.getByText(/showing a sample/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("fires onRetry when the retry control is tapped", () => {
    const onRetry = vi.fn();
    render(<SampleTag onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("uses no em dash in the copy (house rule)", () => {
    render(<SampleTag onRetry={() => {}} />);
    expect(document.body.textContent).not.toContain("—");
  });
});
