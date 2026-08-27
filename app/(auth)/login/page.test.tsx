import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// Regression: after entering the OTP, the login page must NOT hard-navigate with
// window.location.assign. That full-page reload rebooted the app and showed the
// RuneLoader twice ("loading twice"). Verification + routing now live in a server
// action (verifyOtpAction) that redirect()s server-side — a single soft nav.

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithOtp: vi.fn(async () => ({ error: null })) },
  }),
}));

vi.mock("./actions", () => ({
  // Return an error so the flow stays put (a real success redirects server-side,
  // which can't run in jsdom); we only assert the client no longer hard-navigates.
  verifyOtpAction: vi.fn(async () => ({ error: "Invalid code" })),
}));

import LoginPage from "./page";
import { verifyOtpAction } from "./actions";

afterEach(cleanup);

describe("LoginPage OTP verify (double-loader regression)", () => {
  it("verifies via the server action and never calls window.location.assign", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign },
      writable: true,
      configurable: true,
    });

    render(<LoginPage />);

    // Email step → request a code.
    fireEvent.change(screen.getByPlaceholderText(/you@work\.com/i), {
      target: { value: "user@test.com" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /email me a code/i }));
    });

    // Code step → enter and verify.
    const codeInput = await screen.findByPlaceholderText("123456");
    fireEvent.change(codeInput, { target: { value: "123456" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));
    });

    await waitFor(() =>
      expect(verifyOtpAction).toHaveBeenCalledWith("user@test.com", "123456"),
    );
    expect(assign).not.toHaveBeenCalled();
  });
});
