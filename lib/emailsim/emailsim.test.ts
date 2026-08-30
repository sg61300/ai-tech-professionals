import { describe, it, expect } from "vitest";
import { EMAIL_SIM } from "@/content/sims/email";
import { EmailSimSchema, type EmailRule } from "@/content/schema";
import {
  classifyInbox,
  classifyEmail,
  groupByBucket,
  compilePrompt,
  gradeRulebook,
  DEFAULT_BUCKET,
  topEmails,
  inboxCoachGolden,
  sanitizeTopReasons,
  InboxCoachSchema,
} from "./index";

const sim = EMAIL_SIM;

/** A "golden" rulebook: one rule per condition routing to its golden bucket. */
const goldenRules: EmailRule[] = [
  { conditionId: "c-exit", bucketKey: "now" },
  { conditionId: "c-leadership", bucketKey: "now" },
  { conditionId: "c-escalation", bucketKey: "now" },
  { conditionId: "c-leave", bucketKey: "today" },
  { conditionId: "c-invoice", bucketKey: "today" },
  { conditionId: "c-digest", bucketKey: "week" },
  { conditionId: "c-newsletter", bucketKey: "later" },
  { conditionId: "c-social", bucketKey: "later" },
  { conditionId: "c-spam", bucketKey: "later" },
  { conditionId: "c-manager", bucketKey: "today" },
];

describe("EMAIL_SIM content", () => {
  it("is schema-valid with a 10-email inbox", () => {
    expect(() => EmailSimSchema.parse(sim)).not.toThrow();
    expect(sim.inbox).toHaveLength(10);
  });
  it("every starter rule references a real condition", () => {
    for (const r of sim.starterRules) {
      expect(sim.conditions.some((c) => c.id === r.conditionId)).toBe(true);
    }
  });
});

describe("classifyEmail / classifyInbox", () => {
  it("first matching rule wins", () => {
    const rules: EmailRule[] = [
      { conditionId: "c-exit", bucketKey: "week" }, // wrong on purpose, but first
      { conditionId: "c-exit", bucketKey: "now" },
    ];
    const exit = sim.inbox.find((e) => e.tags.includes("exit"))!;
    expect(classifyEmail(sim, rules, exit).bucket).toBe("week");
  });
  it("an unmatched email falls to the default bucket, flagged", () => {
    const spam = sim.inbox.find((e) => e.tags.includes("spam"))!;
    const s = classifyEmail(sim, [], spam);
    expect(s.bucket).toBe(DEFAULT_BUCKET);
    expect(s.matched).toBe(false);
    expect(s.reason).toBeNull();
  });
  it("the golden rulebook reproduces every email's golden bucket", () => {
    for (const s of classifyInbox(sim, goldenRules)) {
      expect(s.bucket).toBe(s.email.goldenBucket);
      expect(s.matched).toBe(true);
    }
  });
});

describe("groupByBucket", () => {
  it("puts the 3 urgent emails in Now under the golden rulebook", () => {
    const g = groupByBucket(sim, classifyInbox(sim, goldenRules));
    expect(g.now.map((s) => s.email.id).sort()).toEqual(["e1", "e2", "e3"]);
  });
});

describe("compilePrompt", () => {
  it("injects readable IF/THEN lines", () => {
    const p = compilePrompt(sim, [{ conditionId: "c-exit", bucketKey: "now" }]);
    expect(p).toContain("IF Mentions resignation / exit → Now");
    expect(p).not.toContain("{rules}");
  });
  it("handles an empty rulebook", () => {
    expect(compilePrompt(sim, [])).toContain("no rules yet");
  });
});

describe("gradeRulebook", () => {
  it("all checks pass on the golden rulebook", () => {
    const r = gradeRulebook(sim, goldenRules);
    expect(r.allClear).toBe(true);
    expect(r.score).toBe(r.total);
    expect(r.improvement).toBe(sim.rubric.allClearNote);
  });
  it("flags missing exit handling as the first improvement", () => {
    // Only handles newsletters → the exits_urgent check fails first.
    const r = gradeRulebook(sim, [{ conditionId: "c-newsletter", bucketKey: "later" }]);
    expect(r.allClear).toBe(false);
    const exitCheck = r.results.find((x) => x.id === "exits_urgent")!;
    expect(exitCheck.passed).toBe(false);
    expect(r.improvement).toBe(
      sim.rubric.checks.find((c) => c.id === "exits_urgent")!.improvement,
    );
  });
  it("passes noise_filtered only when all Later mail is filtered", () => {
    const partial: EmailRule[] = [{ conditionId: "c-newsletter", bucketKey: "later" }];
    const r = gradeRulebook(sim, partial);
    expect(r.results.find((x) => x.id === "noise_filtered")!.passed).toBe(false); // social+spam still unmatched
  });
});

describe("live-AI coach layer (spec §4.1)", () => {
  it("topEmails surfaces the highest-priority mail first", () => {
    const sorted = classifyInbox(sim, goldenRules);
    const top = topEmails(sim, sorted, 4);
    expect(top).toHaveLength(4);
    // The 3 Now emails (e1,e2,e3) must be among the top before any Later mail.
    const topIds = top.map((e) => e.id);
    expect(topIds).toEqual(expect.arrayContaining(["e1", "e2", "e3"]));
    expect(topIds).not.toContain("e9"); // spam (Later) can't be top
  });

  it("inboxCoachGolden falls back to the deterministic rubric improvement", () => {
    const rubric = gradeRulebook(sim, [{ conditionId: "c-newsletter", bucketKey: "later" }]);
    const golden = inboxCoachGolden(rubric);
    expect(golden.coachNote).toBe(rubric.improvement);
    expect(golden.topReasons).toEqual([]);
    expect(() => InboxCoachSchema.parse(golden)).not.toThrow();
  });

  it("sanitizeTopReasons drops reasons for unknown email ids (tamper-safe)", () => {
    const cleaned = sanitizeTopReasons(sim, [
      { emailId: "e1", reason: "urgent exit" },
      { emailId: "nope", reason: "injected" },
    ]);
    expect(cleaned).toEqual([{ emailId: "e1", reason: "urgent exit" }]);
  });
});
