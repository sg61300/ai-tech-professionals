import type { RapidFireSet } from "@/content/schema";

/**
 * RF1 — Foundations rapid-fire (PRD/11). 8 tap-only questions covering
 * Lessons 1–5, including decision-maker/grill-style judgment beats. Passing
 * (6/8) unlocks the first full sim (Inbox Tamer). Fresh scenarios, not copies
 * of the lesson exercises. Voice: fast, fun, encouraging.
 *
 * Authoring note: `correct` is the index into `options`; the ✅ option in the
 * PRD is placed at that index. `teach` is the mandatory 1-line lesson shown
 * after every answer.
 */
export const RF1: RapidFireSet = {
  id: "rf1",
  title: "Rapid Fire · Foundations",
  intro: "Five lessons down. Let's see what stuck — 8 questions, tap fast, don't overthink it. Go!",
  passThreshold: 6,
  unlocksSimId: "sim-email",
  items: [
    {
      id: "rf1-q1",
      kind: "mcq",
      prompt:
        "AI confidently states your company's leave policy allows 30 days — but you never gave it the policy. What do you do?",
      options: [
        "Trust it, it sounded sure",
        "Verify against the actual policy before using it",
        "Forward it to the employee",
        "Ask AI if it's really sure",
      ],
      correct: 1,
      teach: "Without your data, AI guesses. Confidence isn't proof — verify facts.",
      grillStyle: "decision-maker",
    },
    {
      id: "rf1-q2",
      kind: "truefalse",
      prompt: "True or false: AI can see your company's private HRMS data by default.",
      options: ["True", "False"],
      correct: 1,
      teach: "False. It only knows what you paste in — and public tools shouldn't get confidential data.",
    },
    {
      id: "rf1-q3",
      kind: "mcq",
      prompt: "Which prompt will give the most usable result?",
      options: [
        "Write an email.",
        "Write a leave email, make it good.",
        "You are an HR coordinator. The Bengaluru team is confused about the new WFH policy. Write a friendly 120-word announcement.",
        "EMAIL. NOW. PLEASE.",
      ],
      correct: 2,
      teach: "Role + Context + Task + Format beats hope every time.",
    },
    {
      id: "rf1-q4",
      kind: "pickbetter",
      prompt: "Two prompts for a candidate rejection. Which is better?",
      options: [
        "Reject this candidate.",
        "Warmly reject a final-round candidate; thank them for the case study; invite future applications; under 120 words.",
      ],
      correct: 1,
      teach: "Context (stage, intent, tone) is what makes it usable.",
    },
    {
      id: "rf1-q5",
      kind: "mcq",
      prompt: "You want AI to match your company's warm house tone. Best move?",
      options: [
        "Ask it to “be warm”",
        "Paste an example of your existing tone",
        "Add more adjectives",
        "Use exclamation marks!!!",
      ],
      correct: 1,
      teach: "Showing an example (context) beats describing it.",
    },
    {
      id: "rf1-q6",
      kind: "mcq",
      prompt: "A long chat starts giving off-topic answers. Why, and what's the fix?",
      options: [
        "It's broken; restart your laptop",
        "The context window overflowed — start a fresh chat or summarize the key points",
        "Type louder",
        "Wait 10 minutes",
      ],
      correct: 1,
      teach: "Finite memory. Fresh chat for new topics; summarize when long.",
      grillStyle: "decision-maker",
    },
    {
      id: "rf1-q7",
      kind: "truefalse",
      prompt: "True or false: a shorter, focused prompt can be both cheaper and more accurate.",
      options: ["True", "False"],
      correct: 0,
      teach: "True. Fewer tokens = lower cost; less clutter = sharper answer.",
    },
    {
      id: "rf1-q8",
      kind: "mcq",
      prompt: "AI's first draft of a sensitive exit email is accurate but cold. Best next step?",
      options: [
        "Send it — facts are right",
        "One targeted follow-up to warm the tone, then read it yourself before sending",
        "Rewrite the whole thing from scratch",
        "Ask AI if it's happy with it",
      ],
      correct: 1,
      teach: "Iterate on tone; keep a human on anything sensitive.",
      grillStyle: "grill",
    },
  ],
};
