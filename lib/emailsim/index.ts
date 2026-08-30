import { z } from "zod";
import type { EmailSim, EmailRule, EmailBucket, InboxEmail } from "@/content/schema";

/**
 * Inbox-Tamer engine (PRD/09). Pure + deterministic: the user's rulebook IS the
 * classifier, so the sort is correct by construction and never depends on a
 * flaky model. Live AI only decorates the reasons on top (see lib/ai). TDD'd
 * here; shared by the runner (client preview) and the server action.
 *
 * A rule = IF <condition matches the email's tags> THEN <bucket>. Rules are
 * evaluated in order; first match wins. An email that matches no rule falls to
 * the `unmatched` default bucket ("today", flagged) per the compiled prompt.
 */

export const DEFAULT_BUCKET: EmailBucket = "today";

export type Sorted = {
  email: InboxEmail;
  bucket: EmailBucket;
  /** The condition label that placed it, or null when it fell to the default. */
  reason: string | null;
  matched: boolean;
};

/** True when a condition (by id) matches an email. */
function conditionMatches(sim: EmailSim, conditionId: string, email: InboxEmail): boolean {
  const cond = sim.conditions.find((c) => c.id === conditionId);
  return !!cond && email.tags.includes(cond.matchTag);
}

/** Classify one email against the ordered rulebook (first match wins). */
export function classifyEmail(sim: EmailSim, rules: EmailRule[], email: InboxEmail): Sorted {
  for (const rule of rules) {
    if (conditionMatches(sim, rule.conditionId, email)) {
      const label = sim.conditions.find((c) => c.id === rule.conditionId)?.label ?? null;
      return { email, bucket: rule.bucketKey, reason: label, matched: true };
    }
  }
  return { email, bucket: DEFAULT_BUCKET, reason: null, matched: false };
}

/** Classify the whole inbox. */
export function classifyInbox(sim: EmailSim, rules: EmailRule[]): Sorted[] {
  return sim.inbox.map((e) => classifyEmail(sim, rules, e));
}

/** Group a classified inbox by bucket, in the sim's bucket order. */
export function groupByBucket(sim: EmailSim, sorted: Sorted[]): Record<EmailBucket, Sorted[]> {
  const out = {} as Record<EmailBucket, Sorted[]>;
  for (const b of sim.buckets) out[b.key] = [];
  for (const s of sorted) out[s.bucket].push(s);
  return out;
}

/** Compile the rulebook into the human-readable AI prompt (PRD/09 Screen 3). */
export function compilePrompt(sim: EmailSim, rules: EmailRule[]): string {
  const lines =
    rules.length === 0
      ? "  (no rules yet)"
      : rules
          .map((r) => {
            const label = sim.conditions.find((c) => c.id === r.conditionId)?.label ?? r.conditionId;
            const bucket = sim.buckets.find((b) => b.key === r.bucketKey);
            return `  - IF ${label} → ${bucket?.label ?? r.bucketKey}`;
          })
          .join("\n");
  return sim.compiledPromptTemplate.replace("{rules}", lines);
}

// --- Rubric grading (coach card, never gatekeeping) -------------------------
export type RubricResult = {
  id: string;
  label: string;
  passed: boolean;
};
export type Rubric = {
  results: RubricResult[];
  /** First failing check's improvement copy, or the all-clear note. */
  improvement: string;
  allClear: boolean;
  score: number; // passed checks
  total: number;
};

/** Does every email whose golden bucket is `now` get classified `now`? etc. */
function checkPasses(id: string, sim: EmailSim, sorted: Sorted[]): boolean {
  const byId = new Map(sorted.map((s) => [s.email.id, s]));
  const goldIs = (bucket: EmailBucket) => sim.inbox.filter((e) => e.goldenBucket === bucket);

  switch (id) {
    case "exits_urgent":
      // Exit + escalation emails must land in Now.
      return sim.inbox
        .filter((e) => e.tags.includes("exit") || e.tags.includes("escalation"))
        .every((e) => byId.get(e.id)?.bucket === "now");
    case "leadership_separated":
      // Leadership asks must be Now (surfaced fast).
      return sim.inbox
        .filter((e) => e.tags.includes("leadership"))
        .every((e) => byId.get(e.id)?.bucket === "now");
    case "noise_filtered":
      // Everything whose golden home is Later must be classified Later.
      return goldIs("later").every((e) => byId.get(e.id)?.bucket === "later");
    case "all_matched":
      // No email fell through to the default (every email matched a rule).
      return sorted.every((s) => s.matched);
    default:
      return false;
  }
}

export function gradeRulebook(sim: EmailSim, rules: EmailRule[]): Rubric {
  const sorted = classifyInbox(sim, rules);
  const results: RubricResult[] = sim.rubric.checks.map((c) => ({
    id: c.id,
    label: c.label,
    passed: checkPasses(c.id, sim, sorted),
  }));
  const firstFail = sim.rubric.checks.find((c) => !checkPasses(c.id, sim, sorted));
  const allClear = !firstFail;
  return {
    results,
    improvement: firstFail ? firstFail.improvement : sim.rubric.allClearNote,
    allClear,
    score: results.filter((r) => r.passed).length,
    total: results.length,
  };
}

/** Resolve the starter (pre-suggested) rules into concrete EmailRule objects. */
export function starterRules(sim: EmailSim): EmailRule[] {
  return sim.starterRules;
}

// --- Live-AI coach layer (spec §4.1) ----------------------------------------
// One bounded call AFTER the deterministic sort returns a tailored coach note +
// a 5-word "reason" for the top emails (making AI visibly "read" the mail). The
// sort itself is unchanged and authoritative; this is decoration with a golden
// fallback (the existing rubric strings). JSON is validated by callJsonAI.

export const InboxTopReasonSchema = z.object({
  emailId: z.string().min(1),
  reason: z.string().min(1),
});
export const InboxCoachSchema = z.object({
  coachNote: z.string().min(1),
  topReasons: z.array(InboxTopReasonSchema).max(10).default([]),
});
export type InboxTopReason = z.infer<typeof InboxTopReasonSchema>;
export type InboxCoach = z.infer<typeof InboxCoachSchema>;

/** The top `limit` emails after sorting, highest-priority bucket first. */
export function topEmails(sim: EmailSim, sorted: Sorted[], limit = 4): InboxEmail[] {
  const priority = sim.buckets.map((b) => b.key);
  const rank = (b: EmailBucket) => {
    const i = priority.indexOf(b);
    return i === -1 ? priority.length : i;
  };
  return [...sorted]
    .sort((a, b) => rank(a.bucket) - rank(b.bucket))
    .slice(0, limit)
    .map((s) => s.email);
}

/** Scripted fallback: today's deterministic rubric improvement, no per-email reasons. */
export function inboxCoachGolden(rubric: Rubric): InboxCoach {
  return { coachNote: rubric.improvement, topReasons: [] };
}

/** Drop any reason whose emailId isn't a real inbox email (tamper/hallucination-safe). */
export function sanitizeTopReasons(sim: EmailSim, reasons: InboxTopReason[]): InboxTopReason[] {
  const ids = new Set(sim.inbox.map((e) => e.id));
  return reasons.filter((r) => ids.has(r.emailId));
}
