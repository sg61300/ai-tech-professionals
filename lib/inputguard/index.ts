/**
 * `lib/inputguard` — the confidential-data guardrail (spec §3.1).
 *
 * HONEST LIMITATION (stated in-product): we cannot GUARANTEE company-private
 * data is blocked (semantics aren't regex-detectable). We make the safe path the
 * only easy path: design-out (ask for the type/shape, never records) +
 * attestation checkbox carry the real weight; these detectors are a lean
 * backstop. In-product copy is "we block obvious identifiers and never store
 * your text," never "we ensure."
 *
 * Pure + block-on-match, so the SAME module runs client (UX) and server
 * (authority — the client is never trusted). No name detection (unreliable →
 * false blocks). CTO-collapsed detector set: the numeric detectors (Aadhaar /
 * phone / card) fold into one separator-normalized ">=8 consecutive digits"
 * rule; Verhoeff is dropped (dead code behind the digit rule).
 */

/** Hard length cap (spec §3.1 layer 3) — a document can't be pasted. */
export const MAX_LEN = 200;

export type GuardResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

// Detectors run in order; the FIRST match wins and returns its reason.
// Each is authored + unit-tested (match + false-positive guard).
const DETECTORS: { test: (raw: string, upper: string, digits: string) => boolean; reason: string }[] = [
  {
    // Emails and @handles. A bare "@" in a short workflow description is almost
    // always an address or handle, so we block on it (subsumes @<domain>).
    test: (raw) => raw.includes("@"),
    reason: "That looks like an email or handle. Describe the workflow type instead, no addresses.",
  },
  {
    // GSTIN (15 chars) — checked before PAN so the reason is specific; note GSTIN
    // embeds a PAN, so PAN would also catch it.
    test: (_raw, upper) => /\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]Z[A-Z\d]/.test(upper),
    reason: "That looks like a GSTIN. Keep it generic, no tax or registration numbers.",
  },
  {
    // PAN: 5 letters, 4 digits, 1 letter.
    test: (_raw, upper) => /[A-Z]{5}[0-9]{4}[A-Z]/.test(upper),
    reason: "That looks like a PAN. Keep it generic, no ID numbers.",
  },
  {
    // Currency / CTC / salary language.
    test: (raw) => /₹|\b(?:lakh|lakhs|lpa|ctc|crore|salary|stipend)\b/i.test(raw),
    reason: "Leave out pay or CTC figures. Just describe the kind of workflow.",
  },
  {
    // Long digit run (Aadhaar 12 / phone 10 / card 16) — normalized so
    // separators can't hide it.
    test: (_raw, _upper, digits) => /\d{8,}/.test(digits),
    reason: "That looks like a long ID or phone number. Please remove it.",
  },
];

/**
 * Guard a free-text seam. Returns the trimmed text on success, or a
 * human-readable reason on the first detector hit. Never logs the input (DPDP).
 */
export function guardInput(text: string): GuardResult {
  const normalized = text.trim();

  if (normalized.length === 0) {
    return { ok: false, reason: "Type a short description to continue." };
  }
  if (normalized.length > MAX_LEN) {
    return { ok: false, reason: `Keep it under ${MAX_LEN} characters, a short description, not a document.` };
  }

  const upper = normalized.toUpperCase();
  const digits = normalized.replace(/[\s.\-]/g, ""); // strip separators before counting digit runs

  for (const d of DETECTORS) {
    if (d.test(normalized, upper, digits)) return { ok: false, reason: d.reason };
  }

  return { ok: true, normalized };
}
