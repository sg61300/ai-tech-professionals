import { describe, it, expect } from "vitest";
import { guardInput, MAX_LEN } from "./index";

/**
 * The confidential-data guardrail (spec §3.1, CTO-collapsed detector set). Pure
 * functions, block-on-match. Design-out + the attestation checkbox carry the
 * real weight; these detectors are a lean backstop. No name detection.
 */

const okReasonless = (text: string) => {
  const r = guardInput(text);
  expect(r.ok, `expected OK for: ${text}`).toBe(true);
  return r;
};
const blocked = (text: string) => {
  const r = guardInput(text);
  expect(r.ok, `expected BLOCK for: ${text}`).toBe(false);
  return r;
};

describe("guardInput — accepts safe, generic descriptions", () => {
  it("passes a clean workflow description and returns the trimmed text", () => {
    const r = guardInput("  Employee onboarding workflow  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized).toBe("Employee onboarding workflow");
  });

  it("does not false-block small numbers or counts", () => {
    okReasonless("A 5 step approval with a team of 6");
    okReasonless("Review leave in 2 weeks, 3 approvers");
    okReasonless("Recruitment pipeline for 4 open roles");
  });
});

describe("guardInput — blocks obvious identifiers (CTO detector set)", () => {
  it("blocks email addresses / @ handles", () => {
    blocked("send to priya.menon@acme.co.in please");
    blocked("ping @ravi on the exit case");
  });

  it("blocks a PAN number", () => {
    blocked("my pan is ABCDE1234F for the form");
  });

  it("blocks a GSTIN", () => {
    blocked("vendor gst 27ABCDE1234F1Z5 on the invoice");
  });

  it("blocks currency / CTC / salary language", () => {
    blocked("candidate CTC is 12 lakh");
    blocked("offer ₹850000 per year");
    blocked("stipend details for interns");
  });

  it("blocks long digit runs even when separated by spaces/hyphens/dots", () => {
    blocked("aadhaar 1234 5678 9012");
    blocked("call 98765-43210 today");
    blocked("card 4111.1111.1111.1111");
  });
});

describe("guardInput — structural guards", () => {
  it("rejects empty / whitespace-only input", () => {
    blocked("");
    blocked("    ");
  });

  it("rejects input longer than the hard cap (no document paste)", () => {
    blocked("a ".repeat(MAX_LEN)); // well over MAX_LEN chars
  });

  it("accepts input exactly at the cap", () => {
    okReasonless("x".repeat(MAX_LEN));
  });

  it("every block carries a human-readable reason", () => {
    const r = guardInput("priya@acme.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
  });
});
