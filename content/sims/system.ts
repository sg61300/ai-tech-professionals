import type { SystemSim } from "@/content/schema";

/**
 * Sim (c) — "System X-Ray" (PRD/10). Point at an HR workflow → a gamified,
 * tappable data-flow map that highlights where HR fits, flags edge cases, and
 * hands over a requirements starter. MVP ships preset sample systems (the
 * reliable golden path); live text/image generation is a documented post-MVP
 * seam. Dummy/sanitized data only. Full sim (north-star eligible).
 */
export const SYSTEM_SIM: SystemSim = {
  id: "sim-system",
  kind: "system",
  xp: 120,
  badge: "System X-Ray",
  intro: {
    copy: "Ever nodded along in a meeting while someone explained 'the system,' secretly unsure how it actually works? Let's fix that forever. Point at any HR workflow and we'll X-ray it — boxes, arrows, and all.",
    cta: "X-ray a system →",
  },
  safety:
    "⚠️ Use dummy or sanitized examples only. Never paste confidential systems or real employee data into AI.",
  inputCopy:
    "Pick a system to X-ray. Presets always work; describe-your-own is coming soon (we'll map the closest preset for now).",
  edgeCasesCopy:
    "Every system has a trapdoor. Spotting them is what turns 'I use the tool' into 'I understand the tool.'",
  requirementsCopy:
    "You understand the flow. Now turn that into something useful — a starter list you could hand IT or a vendor.",
  requirementsBanner:
    "This is a starting point, not a contract — you add the org-specific bits. (The full 'vendor brief' walkthrough lives in Level 3.)",
  samples: [
    {
      id: "onboarding",
      label: "HRMS onboarding flow",
      nodes: [
        { id: "n1", label: "Offer accepted", kind: "start", hint: "The candidate says yes. This kicks off everything downstream — the clock starts here.", hr: false },
        { id: "n2", label: "Candidate record created in HRMS", kind: "step", hint: "The system creates a profile so every later step has one source of truth.", hr: false },
        { id: "n3", label: "Docs & ID collected", kind: "step", hint: "IDs, tax forms and proofs are gathered — usually the first bottleneck if chased manually.", hr: false },
        { id: "n4", label: "Background check", kind: "decision", hint: "A compliance gate. Everything after this assumes the check passed — which is exactly why it's risky to skip.", hr: false },
        { id: "n5", label: "HR: assign role, buddy, manager", kind: "hr", hint: "HR sets the human context — reporting line, a buddy, the team. Rushing this makes week one chaotic.", hr: true, decisionBeat: "This is where your judgment enters the machine. What could go wrong if it's rushed?" },
        { id: "n6", label: "HR review / hold", kind: "hr", hint: "If the check fails, HR decides — hold, review, or withdraw. A judgment call software can't make for you.", hr: true },
        { id: "n7", label: "Accounts & access provisioned by IT", kind: "it", hint: "IT creates logins, email and system access. If this lags, Day-1 is a mess.", hr: false },
        { id: "n8", label: "Day-1 welcome + orientation", kind: "hr", hint: "First impressions. HR owns whether the joinee feels expected and set up, or lost.", hr: true },
        { id: "n9", label: "Probation tracking begins", kind: "step", hint: "The system schedules review checkpoints. If it never triggers, reviews quietly get missed.", hr: false },
      ],
      edges: [
        { from: "n1", to: "n2" },
        { from: "n2", to: "n3" },
        { from: "n3", to: "n4" },
        { from: "n4", to: "n5", label: "Pass" },
        { from: "n4", to: "n6", label: "Fail" },
        { from: "n5", to: "n7" },
        { from: "n7", to: "n8" },
        { from: "n8", to: "n9" },
      ],
      edgeCases: [
        { risk: "Background check skipped", why: "A hire could start with no compliance record — a legal and audit exposure." },
        { risk: "IT provisioning lags", why: "Day-1 is a mess and the new joinee's first impression tanks." },
        { risk: "Probation tracking never triggers", why: "Reviews get missed, and weak hires slip past the checkpoint unnoticed." },
      ],
      requirements: [
        "Auto-create candidate record on offer acceptance",
        "Enforce background-check gate before role assignment",
        "Trigger IT access provisioning automatically after HR sign-off",
        "Auto-start probation tracking with a reminder to the manager",
        "Flag any skipped step for HR review",
      ],
      comprehension: {
        prompt: "Tap the step where HR makes the key people-decision.",
        correctNodeId: "n5",
        insight: "Assigning role, buddy and manager is the human judgment call — the system can route, but it can't decide who someone should report to.",
        hint: "Look for the step a machine couldn't decide on its own — where a person's context is set.",
      },
      mermaid: `flowchart TD
  A[Offer accepted] --> B[Candidate record created]
  B --> C[Docs & ID collected]
  C --> D{Background check}
  D -- Pass --> E[HR: assign role, buddy, manager]
  D -- Fail --> F[HR review / hold]
  E --> G[Accounts & access by IT]
  G --> H[Day-1 welcome + orientation]
  H --> I[Probation tracking begins]`,
    },
    {
      id: "leave",
      label: "Leave-approval workflow",
      nodes: [
        { id: "l1", label: "Employee applies for leave", kind: "start", hint: "The request enters the system with dates and a reason.", hr: false },
        { id: "l2", label: "Balance check", kind: "decision", hint: "The system checks entitlement. Auto-approving without this causes negative balances.", hr: false },
        { id: "l3", label: "Manager approves", kind: "step", hint: "The manager weighs team coverage. A human trade-off the system can only surface, not decide.", hr: false },
        { id: "l4", label: "HR records & updates balance", kind: "hr", hint: "HR is the system of record. If this is skipped, payroll and balances drift out of sync.", hr: true, decisionBeat: "If HR never records it, where does the truth about someone's leave actually live?" },
        { id: "l5", label: "Payroll & calendar updated", kind: "step", hint: "Downstream systems sync so pay and team calendars stay correct.", hr: false },
      ],
      edges: [
        { from: "l1", to: "l2" },
        { from: "l2", to: "l3", label: "OK" },
        { from: "l2", to: "l1", label: "Insufficient" },
        { from: "l3", to: "l4" },
        { from: "l4", to: "l5" },
      ],
      edgeCases: [
        { risk: "Balance check skipped", why: "Employees go into negative leave and payroll has to claw it back later." },
        { risk: "HR record step missed", why: "The official balance and payroll drift apart — disputes follow." },
      ],
      requirements: [
        "Block approval when the leave balance is insufficient",
        "Require manager approval before HR records",
        "Auto-sync approved leave to payroll and the team calendar",
        "Keep an audit trail of who approved what, when",
      ],
      comprehension: {
        prompt: "Tap the step that is HR's system-of-record responsibility.",
        correctNodeId: "l4",
        insight: "HR recording the leave is what makes it official — that's the single source of truth payroll trusts.",
        hint: "Which step decides what payroll will believe is true?",
      },
      mermaid: `flowchart TD
  A[Employee applies] --> B{Balance check}
  B -- OK --> C[Manager approves]
  B -- Insufficient --> A
  C --> D[HR records & updates balance]
  D --> E[Payroll & calendar updated]`,
    },
    {
      id: "recruitment",
      label: "Recruitment / ATS pipeline",
      nodes: [
        { id: "r1", label: "Job requisition opened", kind: "start", hint: "A role is approved and posted — the pipeline's starting gun.", hr: false },
        { id: "r2", label: "Applications collected in ATS", kind: "step", hint: "The system gathers and de-duplicates candidates in one place.", hr: false },
        { id: "r3", label: "Screening", kind: "decision", hint: "Filter to a shortlist. Over-automating here is where bias can creep in.", hr: false },
        { id: "r4", label: "HR: shortlist & schedule interviews", kind: "hr", hint: "HR owns fairness and the candidate experience — who advances, and how they're treated.", hr: true, decisionBeat: "If screening is fully automated, who is accountable for a biased shortlist?" },
        { id: "r5", label: "Interviews & scorecards", kind: "step", hint: "Structured feedback is captured so decisions are comparable, not vibes.", hr: false },
        { id: "r6", label: "Offer & close", kind: "hr", hint: "HR extends the offer and closes the loop with every candidate — including the 'no's.", hr: true },
      ],
      edges: [
        { from: "r1", to: "r2" },
        { from: "r2", to: "r3" },
        { from: "r3", to: "r4", label: "Shortlist" },
        { from: "r4", to: "r5" },
        { from: "r5", to: "r6" },
      ],
      edgeCases: [
        { risk: "Screening fully automated", why: "An unchecked filter can quietly encode bias into who ever gets seen." },
        { risk: "Rejected candidates left hanging", why: "Silence damages the employer brand and future pipelines." },
      ],
      requirements: [
        "Keep a human in the loop on shortlisting decisions",
        "Capture structured interview scorecards for comparability",
        "Auto-notify every candidate of an outcome, including rejections",
        "Log screening criteria for a bias/audit review",
      ],
      comprehension: {
        prompt: "Tap the step where HR must stay accountable for fairness.",
        correctNodeId: "r4",
        insight: "Shortlisting is where fairness is won or lost — a human has to own who advances.",
        hint: "Where would an unchecked algorithm do the most quiet damage?",
      },
      mermaid: `flowchart TD
  A[Requisition opened] --> B[Applications in ATS]
  B --> C{Screening}
  C -- Shortlist --> D[HR: shortlist & schedule]
  D --> E[Interviews & scorecards]
  E --> F[Offer & close]`,
    },
  ],
  celebration: {
    copy: "You just X-rayed a system, found its trapdoors, and drafted requirements for it. That's not 'using AI' — that's thinking like an architect.",
  },
  grillBeat: {
    prompt: "Which single step, if it failed, would cause the most damage?",
    branches: [
      {
        choice: "The compliance gate (background check)",
        retort:
          "Right. A failure there is costly and hard to reverse — someone starts with no compliance record, and unwinding that is a legal headache.",
        correct: true,
      },
      {
        choice: "The Day-1 orientation",
        retort:
          "A rough Day-1 stings, but it's recoverable. A skipped compliance gate is the failure you can't easily undo.",
      },
      {
        choice: "The probation reminder",
        retort:
          "Missing a review is bad, but fixable. The costliest, least-reversible failure is the compliance gate.",
      },
    ],
  },
};
