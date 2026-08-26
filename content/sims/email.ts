import type { EmailSim } from "@/content/schema";

/**
 * Sim (a), "Inbox Tamer" (PRD/09). The first FULL sim and the north-star
 * "first simulation completed". A visual rule-builder that compiles into an AI
 * prompt; the sort itself is deterministic from the user's rules (correct by
 * construction, never breaks), with a live-AI reason pass layered on. All dummy
 * data (privacy habit). Unlocks after RF1.
 */
export const EMAIL_SIM: EmailSim = {
  id: "sim-email",
  kind: "email",
  xp: 120,
  badge: "Inbox Tamer",
  intro: {
    copy: "You've learned to talk to AI. Time to make it earn its keep. We'll build an email sorter that reads your inbox and files everything by importance, you set the rules, AI does the reading. Think of it as an intern who never asks for a chai break.",
    cta: "Build my sorter →",
  },
  inboxIntro:
    "Ten emails. One's a resignation, one's a Diwali-fest photo dump, and one's a vendor who just discovered the 🔥 emoji. Which should AI surface first?",
  buckets: [
    { key: "now", label: "Now", emoji: "🔴", blurb: "Drop everything" },
    { key: "today", label: "Today", emoji: "🟡", blurb: "Before you log off" },
    { key: "week", label: "This week", emoji: "🟢", blurb: "FYI / no rush" },
    { key: "later", label: "Later", emoji: "⚪", blurb: "Noise / ignore" },
  ],
  inbox: [
    { id: "e1", from: "Priya Menon (employee)", fromType: "employee", subject: "Resignation, last working day", tags: ["exit"], goldenBucket: "now" },
    { id: "e2", from: "CEO's office", fromType: "leadership", subject: "Need headcount numbers by 11 AM", tags: ["leadership"], goldenBucket: "now" },
    { id: "e3", from: "Ethics line (anonymous)", fromType: "escalation", subject: "Complaint about my manager", tags: ["escalation"], goldenBucket: "now" },
    { id: "e4", from: "Rahul (employee)", fromType: "employee", subject: "Leave request for next week", tags: ["leave"], goldenBucket: "today" },
    { id: "e5", from: "Vendor", fromType: "vendor", subject: "Your L&D invoice is due", tags: ["invoice"], goldenBucket: "today" },
    { id: "e6", from: "HRMS system", fromType: "system", subject: "Weekly attendance digest", tags: ["digest"], goldenBucket: "week" },
    { id: "e7", from: "Internal comms", fromType: "system", subject: "Newsletter: Diwali fest photos 🎉", tags: ["newsletter"], goldenBucket: "later" },
    { id: "e8", from: "LinkedIn", fromType: "social", subject: "You have 12 new notifications", tags: ["social"], goldenBucket: "later" },
    { id: "e9", from: "Random vendor", fromType: "vendor", subject: "🔥 Boost hiring with our AI tool!!!", tags: ["spam"], goldenBucket: "later" },
    { id: "e10", from: "Meera Nair (manager)", fromType: "manager", subject: "Quick sync on Ananya's onboarding", tags: ["manager-sync"], goldenBucket: "today" },
  ],
  conditions: [
    { id: "c-exit", label: "Mentions resignation / exit", matchTag: "exit" },
    { id: "c-leadership", label: "From leadership", matchTag: "leadership" },
    { id: "c-escalation", label: "Complaint / ethics escalation", matchTag: "escalation" },
    { id: "c-leave", label: "Leave request", matchTag: "leave" },
    { id: "c-invoice", label: "Vendor invoice", matchTag: "invoice" },
    { id: "c-digest", label: "System digest / report", matchTag: "digest" },
    { id: "c-newsletter", label: "Newsletter", matchTag: "newsletter" },
    { id: "c-social", label: "Social notification", matchTag: "social" },
    { id: "c-spam", label: "Promo / spam", matchTag: "spam" },
    { id: "c-manager", label: "Manager sync request", matchTag: "manager-sync" },
  ],
  starterRules: [
    { conditionId: "c-exit", bucketKey: "now" },
    { conditionId: "c-newsletter", bucketKey: "later" },
  ],
  decisionBeat:
    "Why did you rank that one urgent? That judgment is exactly what you're teaching the AI.",
  compiledPromptTemplate:
    "You are my HR inbox assistant. Sort each email into Now / Today / This week / Later using these rules:\n{rules}\nFor each email, output the bucket + a 5-word reason. If an email matches no rule, put it in 'Today' and flag it for me.",
  compiledPromptCopy:
    "Surprise, your “automation” is really just a well-structured prompt. That's the whole trick.",
  rubric: {
    checks: [
      {
        id: "exits_urgent",
        label: "Covered exits & escalations as urgent",
        improvement:
          "You didn't route anonymous complaints to Now, want a rule so those never get buried?",
      },
      {
        id: "leadership_separated",
        label: "Surfaced leadership requests fast",
        improvement:
          "Leadership asks (like the CEO's 11 AM deadline) should jump the queue, add a 'from leadership → Now' rule.",
      },
      {
        id: "noise_filtered",
        label: "Filtered the noise (newsletters, social, spam)",
        improvement:
          "Some noise still landed up top, send newsletters, social pings and promos to Later.",
      },
      {
        id: "all_matched",
        label: "Gave every email a home",
        improvement:
          "A few emails matched no rule and fell to 'Today'. Add rules so nothing slips through unsorted.",
      },
    ],
    allClearNote:
      "Clean sweep, every email landed where it belongs. That's a rulebook you could run for real tomorrow.",
  },
  tweakCopy: "Change one rule and watch your inbox re-sort.",
  tweakDecisionBeat:
    "See how one rule reshaped everything? That's you designing the system, not just using it.",
  setup: {
    copy: "You built it here on dummy data. Here's how to run this on your actual inbox.",
    safety:
      "⚠️ Use your company-approved AI tool. Never paste confidential email into a personal or public AI account.",
    paths: [
      {
        key: "A",
        title: "No-setup (works today, manual)",
        steps: [
          "Copy your compiled prompt (button above).",
          "Open your approved AI assistant (company Copilot / Gemini / ChatGPT).",
          "Paste the prompt, then paste sanitized subject lines + senders.",
          "Get your sorted list. Zero tech, works immediately.",
        ],
      },
      {
        key: "B",
        title: "Semi-automated (Gmail / Outlook, no code)",
        steps: [
          "Gmail: Settings → Filters → Create filter (or Outlook Rules).",
          "Recreate each rule as a filter: from leadership → label 'Now', newsletters → label 'Later' + skip inbox.",
          "Gmail/Outlook auto-applies them to incoming mail, your rulebook, running for real.",
        ],
      },
      {
        key: "C",
        title: "Fully automated (for the ambitious)",
        steps: [
          "Connect your inbox to a workflow tool with an official email connector, authorize via secure OAuth, never by pasting your password.",
          "Add an 'AI classify' step that uses your compiled prompt.",
          "Route each email to a folder/label by the AI's bucket.",
        ],
        note: "Path C is previewed here; the full 'build an agent' walkthrough lives in Level 3. Paths A & B get you real value today.",
      },
    ],
  },
  celebration: {
    copy: "You built an inbox assistant AND know how to run it for real, while the vendor with three fire emojis sits exactly where he belongs. That's a decision-maker move.",
  },
  grillBeat: {
    prompt: "If you could keep only ONE sorting rule, which would it be?",
    branches: [
      {
        choice: "Route exits & complaints to Now",
        retort:
          "Exactly. A missed resignation or complaint is the costliest error, protecting people-critical mail is the rule that matters most.",
        correct: true,
      },
      {
        choice: "Send newsletters to Later",
        retort:
          "Tidy, but low stakes. A missed newsletter costs nothing; a missed resignation costs a lot. Protect the people-critical mail first.",
      },
      {
        choice: "File invoices under Today",
        retort:
          "Useful, but an invoice can wait a day. The rule you can't live without is the one guarding exits and escalations.",
      },
    ],
  },
};
