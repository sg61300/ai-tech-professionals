import type { RapidFireSet } from "@/content/schema";

/**
 * RF2 — HR Daily Toolkit rapid-fire (PRD/11). 8 tap-only questions covering
 * Lessons 6-10, including decision-maker/grill-style judgment beats. Passing
 * (6/8) unlocks the second full sim (System X-Ray). Fresh scenarios, not copies
 * of the lesson exercises. Voice: fast, fun, encouraging.
 *
 * Authoring note: `correct` is the index into `options`; the ✅ option in the
 * PRD is placed at that index. `teach` is the mandatory 1-line lesson shown
 * after every answer.
 */
export const RF2: RapidFireSet = {
  id: "rf2",
  title: "Rapid Fire · Daily Toolkit",
  intro: "Round two, the daily-toolkit lightning round. 8 questions, fingers ready. Go!",
  passThreshold: 5,
  unlocksSimId: "sim-system",
  items: [
    {
      id: "rf2-q1",
      kind: "mcq",
      prompt: "Your well-built sorter scans the inbox. Which should it surface FIRST?",
      options: [
        "Diwali fest newsletter",
        "An employee's resignation",
        "\"🔥 Buy our AI tool!!!\"",
        "A birthday reminder",
      ],
      correct: 1,
      teach: "People-critical mail (exits, escalations) always rises to the top.",
    },
    {
      id: "rf2-q2",
      kind: "mcq",
      prompt: "Best way to make AI sort your inbox your way?",
      options: [
        "Tell it \"sort my emails\"",
        "Give it your priority rules (what's urgent vs noise)",
        "Hope for the best",
        "Forward everything and pray",
      ],
      correct: 1,
      teach: "You set the rules; AI does the reading.",
    },
    {
      id: "rf2-q3",
      kind: "mcq",
      prompt: "AI-generated minutes list an action item with no owner and no date. What do you do?",
      options: [
        "Ship it, looks tidy",
        "Add the owner and deadline yourself and verify it's real",
        "Delete the item",
        "Assume AI knew who",
      ],
      correct: 1,
      teach: "Owners and dates are where minutes matter, and where AI guesses.",
      grillStyle: "decision-maker",
    },
    {
      id: "rf2-q4",
      kind: "truefalse",
      prompt: "True or false: when tidying notes, AI can invent who agreed to what.",
      options: ["True", "False"],
      correct: 0,
      teach: "True, the 'tidy-liar'. Always eyeball owners and decisions before sending.",
    },
    {
      id: "rf2-q5",
      kind: "pickbetter",
      prompt: "Which presentation-outline prompt works best?",
      options: [
        "\"Make a deck about the policy.\"",
        "\"Outline a 6-slide all-hands deck on the WFH policy, audience: all staff, goal: explain plus reassure, title plus 2 bullets per slide.\"",
      ],
      correct: 1,
      teach: "Audience + goal + structure = a deck you can build on.",
    },
    {
      id: "rf2-q6",
      kind: "mcq",
      prompt: "An employee asks about their leave balance. Safest approach?",
      options: [
        "Let AI guess the policy",
        "Ground AI in the actual (sanitized) policy, then review before sending",
        "Auto-send AI's reply instantly",
        "Ignore it",
      ],
      correct: 1,
      teach: "Ground it in policy; never auto-send entitlement answers.",
      grillStyle: "decision-maker",
    },
    {
      id: "rf2-q7",
      kind: "mcq",
      prompt: "Which is the RISKIEST thing to let AI finalize on its own?",
      options: [
        "Rewording a welcome email",
        "Writing the official reason for a termination",
        "Summarizing a meeting",
        "Suggesting job-title synonyms",
      ],
      correct: 1,
      teach: "People-decisions with legal weight need a human owner.",
      grillStyle: "grill",
    },
    {
      id: "rf2-q8",
      kind: "mcq",
      prompt: "You spot gendered wording in an AI-drafted job description. The lesson?",
      options: [
        "AI is always neutral",
        "AI can echo human bias, always scan outputs for it",
        "Ignore it, it's fine",
        "Add more buzzwords",
      ],
      correct: 1,
      teach: "Trained on human data, so it can repeat human bias. Your radar stays on.",
      grillStyle: "grill",
    },
  ],
};
