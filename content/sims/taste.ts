import type { TasteSim } from "@/content/schema";

/**
 * Taste sim — "Ship Your First AI Draft" (PRD/08). Unlocks after Lesson 2.
 * A ~3-4 min guided 4-part-prompt builder that ends in one live Gemini
 * generation (scripted fallback below). Dummy data only. No rubric: success is
 * completion. House rule: no em dashes in learner copy.
 */
export const TASTE_SIM: TasteSim = {
  id: "taste-sim",
  kind: "taste",
  xp: 40,
  badge: "First Draft",
  intro: {
    copy: "You just learned the 4-part prompt. Let's use it for real. In 3 minutes you'll build a prompt and watch AI write an email you'd actually send. Meet Ananya, your new joinee starting Monday.",
    cta: "Let's build it",
  },
  role: {
    promptBar: "You are ___",
    copy: "First, who should the AI pretend to be? (Yes, this genuinely changes the answer.)",
    decisionBeat: "Role sets the voice. Same facts, very different email.",
    options: [
      { label: "an experienced HR coordinator", value: "an experienced HR coordinator", correct: true },
      {
        label: "a Shakespearean poet",
        value: "a Shakespearean poet",
        correct: false,
        preview: "Hark! Thy timesheet awaiteth...",
        nudge: "Fun, but Ananya might be confused. Try the HR coordinator.",
      },
      {
        label: "a corporate lawyer",
        value: "a corporate lawyer",
        correct: false,
        preview: "Pursuant to clause 4.2, the undersigned shall report...",
        nudge: "A bit stiff for a welcome. Try the HR coordinator.",
      },
    ],
  },
  context: {
    promptBar: "Here's the situation: ___",
    copy: "Now feed it what only you know. Tap the details to include, AI can't guess these.",
    minSelect: 3,
    decisionBeat: "The more relevant context you give, the less AI has to invent.",
    facts: [
      { label: "Start day: Monday", value: "she starts Monday" },
      { label: "Reporting: 10:00 AM", value: "reporting time is 10:00 AM" },
      { label: "Location: 3rd floor, Prestige Tech Park", value: "location is 3rd floor, Prestige Tech Park, Bengaluru" },
      { label: "Dress code: smart casual", value: "dress code is smart casual" },
      { label: "Meet Rahul (HR buddy) at reception", value: "she should meet Rahul, her HR buddy, at reception" },
    ],
    distractors: [
      { label: "Ananya's home address", warning: "Personal and confidential, don't feed this to AI. Untapped." },
      { label: "The office WiFi password", warning: "Not needed here." },
    ],
  },
  format: {
    promptBar: "Please write a warm Day-1 welcome email. Format: ___",
    copy: "Last step, how should it look?",
    decisionBeat: "Format is you telling AI how to serve the dish.",
    toggles: [
      { label: "Warm and friendly tone", value: "warm, friendly tone", recommended: true },
      { label: "Under 150 words", value: "under 150 words", recommended: true },
      { label: "Bullet the logistics", value: "bullet the logistics", recommended: true },
      { label: "Add a one-line welcome from manager Meera", value: "include a one-line welcome from her manager, Meera Nair", recommended: false },
    ],
  },
  assembled: {
    task: "Write a warm Day-1 welcome email to Ananya.",
    preface: "You built this. Ready to watch it work?",
    cta: "Generate my email",
  },
  liveGen: {
    promptTemplate:
      "You are {role}. Here's the situation: a new joinee, Ananya Sharma (Marketing Associate), {context}. {task} Format: {format}. Use only the facts provided, do not invent details.",
  },
  fallbackOutput: [
    "Subject: Welcome to the team, Ananya! 🎉",
    "",
    "Hi Ananya,",
    "",
    "We're so glad you're joining us as Marketing Associate this Monday, the team can't wait to meet you! Here's everything for a smooth Day 1:",
    "",
    "- 🕙 Reporting time: 10:00 AM",
    "- 📍 Where: 3rd floor, Prestige Tech Park, Bengaluru",
    "- 👔 Dress code: smart casual",
    "- 🤝 First stop: Rahul, your HR buddy, will meet you at reception",
    "- 👋 Your manager, Meera Nair, is looking forward to saying hello",
    "",
    "Come as you are and bring your questions, we've got the rest covered. See you Monday!",
    "",
    "Warm regards,",
    "The People Team",
  ].join("\n"),
  celebration: {
    copy: "You just shipped your first AI draft, built from your own 4-part prompt. That's the whole skill.",
  },
  grillBeat: {
    prompt: "Which of your choices changed the email the most?",
    branches: [
      {
        choice: "Context",
        retort:
          "Usually right. The specific facts are what made it Ananya's email and not a generic template.",
      },
      {
        choice: "Role",
        retort: "Role sets the voice, but the facts (context) are what made this email truly hers.",
      },
      {
        choice: "Format",
        retort:
          "Format shapes the look, but the context (the real facts) is what carried the most weight here.",
      },
    ],
  },
};
