import type { BiasSim } from "@/content/schema";

/**
 * Sim (d), "Bias Catcher" (spec §4.3). The Level-1 capstone. A 7-beat sim around
 * a visible before/after ranking: AI screens 6 dummy candidates with a
 * deliberately naive prompt that over-weights college pedigree and penalizes an
 * employment gap; the learner audits the biased reasons, fixes the prompt with
 * curated toggles, and watches a fairer re-rank. AI does real work, the human
 * stays accountable. All dummy data (DPDP). House rule: no em dashes.
 *
 * Seeded noise: Meera (c3) has strong role merit but an unknown college AND a
 * childcare-coded gap, so the naive prompt buries her last; the fair re-rank
 * lifts her to 3rd. Rohan (c5) has weak merit but an elite college, so he rides
 * the pedigree halo to 3rd in round 1 and drops to last when it is removed. That
 * swap is the "AI helped, but I made it fair" moment.
 */
export const BIAS_SIM: BiasSim = {
  id: "sim-bias",
  kind: "bias",
  xp: 120,
  badge: "Bias Catcher",
  intro: {
    copy: "AI can screen 200 resumes in 10 seconds. Should you trust its picks? Let's find out, then make it fair.",
    cta: "Screen the stack",
  },
  hook: "You're hiring an HR Executive. Six people applied. Let's let AI rank them, then check its work.",
  jobTitle: "HR Executive",
  jobTitleInputCopy: "Want to try your own role? Type a job title (no names or company details).",
  stackCopy: "Six candidates, all dummy profiles. Each has real, role-relevant strengths, plus a couple of details that shouldn't decide anything.",
  candidates: [
    { id: "c1", name: "Aarav", role: "HR generalist, 5 yrs", merit: "Ran onboarding for 300+ hires; strong on policy and grievance handling", college: "Top-tier institute", eliteCollege: true, hasGap: false },
    { id: "c2", name: "Diya", role: "HR ops, 5 yrs", merit: "Built the leave and payroll-sync process end to end; excellent stakeholder reviews", college: "State university", eliteCollege: false, hasGap: false },
    { id: "c3", name: "Meera", role: "HR business partner, 6 yrs", merit: "Led a restructuring with zero compliance issues; deepest people-management record here", college: "Regional college", eliteCollege: false, hasGap: true, gapNote: "18-month gap for childcare" },
    { id: "c4", name: "Kabir", role: "Recruiter, 4 yrs", merit: "Solid recruitment metrics; some exposure to HR operations", college: "Top-tier institute", eliteCollege: true, hasGap: false },
    { id: "c5", name: "Rohan", role: "HR coordinator, 2 yrs", merit: "Early-career; mostly scheduling and coordination so far", college: "Top-tier institute", eliteCollege: true, hasGap: false },
    { id: "c6", name: "Sana", role: "HR generalist, 4 yrs", merit: "Reliable on ops and employee queries; growing into partnering work", college: "State university", eliteCollege: false, hasGap: false },
  ],
  round1Copy: "Here's how AI ranked them from a quick, naive prompt. Read the reasons closely.",
  auditCopy: "Some of these reasons are fair. Some shouldn't decide a hire at all. Tap every reason that shouldn't matter.",
  auditReasons: [
    { id: "a-elite", label: "Went to a top-tier college", biased: true },
    { id: "a-gap", label: "Has an employment gap", biased: true },
    { id: "a-merit", label: "Strong, role-relevant HR experience", biased: false },
    { id: "a-grievance", label: "Handled grievances and compliance well", biased: false },
    { id: "a-stakeholder", label: "Good stakeholder and review feedback", biased: false },
  ],
  fixCopy: "Now fix the prompt. Pick the instructions that make the ranking fair.",
  fixToggles: [
    { id: "f-skills", label: "Judge role-relevant skills only", debiasing: true, effect: "Rank strictly on role-relevant HR skills and experience." },
    { id: "f-college", label: "Ignore college tier", debiasing: true, effect: "Do not consider which college a candidate attended." },
    { id: "f-gap", label: "Don't penalize employment gaps", debiasing: true, effect: "Do not penalize candidates for employment gaps." },
    { id: "f-prestige", label: "Prefer candidates from prestigious colleges", debiasing: false, effect: "Prefer candidates from prestigious colleges." },
  ],
  round2Copy: "Same candidates, fairer instructions. Watch the order change.",
  // Naive prompt: elite college first, penalize the gap. Rohan (weak merit) rides the halo to 3rd; Meera (strong merit) is buried last.
  goldenBiased: [
    { rank: 1, candidateId: "c1", reason: "Top-tier college and no gaps" },
    { rank: 2, candidateId: "c4", reason: "Prestigious college, clean record" },
    { rank: 3, candidateId: "c5", reason: "Elite college signals quality" },
    { rank: 4, candidateId: "c2", reason: "Good record but ordinary college" },
    { rank: 5, candidateId: "c6", reason: "Non-elite college background" },
    { rank: 6, candidateId: "c3", reason: "Strong record but has an employment gap" },
  ],
  // Fair prompt: role-relevant merit only. Meera rises to 3rd; Rohan drops to last.
  goldenFair: [
    { rank: 1, candidateId: "c1", reason: "Deep HR generalist and policy experience" },
    { rank: 2, candidateId: "c2", reason: "Owns the leave and payroll process end to end" },
    { rank: 3, candidateId: "c3", reason: "Strongest people-management and compliance record" },
    { rank: 4, candidateId: "c4", reason: "Solid recruiting with some HR-ops exposure" },
    { rank: 5, candidateId: "c6", reason: "Reliable generalist, still growing into partnering" },
    { rank: 6, candidateId: "c5", reason: "Early-career, mostly coordination so far" },
  ],
  celebration: {
    copy: "You caught the bias, fixed the prompt, and made the shortlist fair. AI is fast. You're accountable. That's the job.",
  },
  grillBeat: {
    prompt: "AI gave you a ranking in seconds. Who is responsible if it's biased?",
    branches: [
      {
        choice: "You are. AI ranks, you decide.",
        retort: "Exactly. Speed is AI's job; accountability is yours. You own the shortlist and the fairness of it.",
        correct: true,
      },
      {
        choice: "The AI, it made the ranking.",
        retort: "Tempting, but a tool can't be accountable. You chose to use it and you sign off on the result, so the responsibility is yours.",
      },
      {
        choice: "No one, it's just a suggestion.",
        retort: "A biased shortlist harms real people whether or not you call it a suggestion. The person who acts on it is accountable, and that's you.",
      },
    ],
  },
};
