import {
  SENIORITY_OPTIONS,
  PROFESSION_OPTIONS,
  AI_LEVEL_OPTIONS,
} from "@/lib/onboarding";

/**
 * Display labels for the profile enum fields (stored lowercase: entry/hr/l1).
 * One source of truth so Profile and anywhere else agree on casing.
 *  - Org role   : Title Case (Entry / Mid / Senior)
 *  - Profession : "HR" as an uppercase initialism; others keep their Title-Case label
 *  - AI level   : uppercase short code (L1 / L2 / L3)
 */
export function seniorityLabel(value?: string | null): string | null {
  if (!value) return null;
  return SENIORITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function professionLabel(value?: string | null): string | null {
  if (!value) return null;
  if (value === "hr") return "HR";
  const opt = PROFESSION_OPTIONS.find((o) => o.value === value);
  return opt?.label ?? value;
}

export function proficiencyLabel(value?: string | null): string | null {
  if (!value) return null;
  const opt = AI_LEVEL_OPTIONS.find((o) => o.value === value);
  // "l1" -> "L1" (fall back to uppercasing a short code if it isn't a known option)
  return opt ? value.toUpperCase() : value.toUpperCase();
}
