import type { Lesson } from "@/content/schema";

/**
 * Level 1, Unit 3 — "Think Like a Decision-Maker" (Lessons 11-12, the L1
 * capstone). Authored from PRD/07. Same shape/voice as Units 1-2.
 *
 * House rule (Session 07): no em dashes in learner-facing copy (commas instead).
 * PRD "fix-prompt" and "scenario MCQ" exercises are modelled as `mcq`.
 * After Lesson 12 the Learn path reveals Level 2 as a locked outline.
 */
export const L1_UNIT3: Lesson[] = [
  {
    id: "l11",
    unit: 3,
    title: "Your \"second brain\"",
    blocks: [
      {
        type: "text",
        md: "If you're writing the same kind of prompt from scratch every Monday, you're doing unpaid overtime for the robot. Let's build you a shortcut drawer. Every time a prompt nails it, keep it. A prompt library is your operating system for AI: recurring task, saved template.",
      },
      {
        type: "callout",
        tone: "tip",
        md: "**Templates with [blanks].** Write templates with fill-in-the-blank [SQUARE BRACKETS], they double as a built-in checklist so you never forget the context. Example: \"You are an HR manager. Draft a [type] email to [audience] about [topic]. Tone: [tone]. Under [N] words.\" Fill four blanks, done.",
      },
      {
        type: "callout",
        tone: "info",
        md: "**Your context doc is your second brain.** Keep one master note with your reusable context: house tone of voice, standard structures, common (sanitized) policy wording. Paste it in and AI stops sounding like a polite stranger and starts sounding like you.",
      },
      {
        type: "callout",
        tone: "ai",
        md: "**Try it.** Build three templates you'll use weekly: a welcome email, a policy announcement, and meeting minutes. For each, write a reusable prompt with [brackets] for the bits that change, and save them somewhere you'll actually find them.",
      },
    ],
    exercise: {
      kind: "mcq",
      prompt: "Which change turns a one-off prompt into a reusable template?",
      options: [
        "Replace the specifics with [bracketed variables] (e.g. [audience], [topic], [tone]) so you refill them each time.",
        "Make it much longer.",
        "Add \"please\" three times.",
        "Delete all the details so it's \"flexible.\"",
      ],
      answer: 0,
      feedback: {
        correct:
          "Yes. Bracketed variables make a prompt reusable and remind you what context to supply, flexibility without vagueness.",
        incorrect:
          "Not quite. Length, politeness, and deleting details don't make a template. Bracketed variables do, and they act as a context checklist.",
      },
    },
    grillBeat: {
      prompt: "Which of your daily tasks most deserves a saved template?",
      branches: [
        {
          choice: "The one I dread repeating, the weekly announcement or standard reply.",
          retort:
            "Exactly. Template the boring, repeatable stuff first, that's where the time comes back.",
        },
        {
          choice: "The rare one-off I do once a year.",
          retort:
            "Low payoff. A template earns its keep on the tasks you repeat often, not the once-a-year ones.",
        },
      ],
    },
    flavor: {
      entry:
        "For your level: start a personal prompt note with the three replies you send most this month.",
      mid: "For your level: share a small team template pack so everyone's announcements sound consistent.",
      senior:
        "For your level: own the master context doc for your function, house tone and standard structures, so the whole team's AI output stays on-brand.",
    },
  },
  {
    id: "l12",
    unit: 3,
    title: "Decision-maker capstone",
    blocks: [
      {
        type: "text",
        md: "You've learned to make AI useful. The final, most valuable skill is knowing where it *stops*, the line between a helpful tool and a decision that must stay yours.",
      },
      {
        type: "callout",
        tone: "tip",
        md: "**The three-bucket test.** Every HR task lands in one of three buckets. 🟩 AI-lead: language work, drafts, summaries, rewrites, first outlines. 🟨 Hybrid: AI drafts, you decide, shortlists, feedback, policy explanations. 🟥 Human-lead: people decisions and sensitive calls, who to hire, promote, or exit, grievances. AI can inform, never own.",
      },
      {
        type: "text",
        md: "**Enabler, not replacer.** Let AI take the repetitive load so you spend your hours on the strategic, human work. That's the whole promotion arc of Level 1: from task-implementer to decision-maker. The robot does the typing, you do the thinking.",
      },
      {
        type: "callout",
        tone: "warn",
        md: "**The \"can you defend it?\" rule.** If you couldn't stand in front of an employee (or an auditor) and explain why, the decision isn't ready, no matter how confidently AI phrased it. Own it or don't ship it.",
      },
    ],
    exercise: {
      kind: "mcq",
      prompt: "Which task belongs firmly in the 🟥 Human-lead bucket?",
      options: [
        "Rewriting a job ad to sound friendlier.",
        "Summarizing 20 survey responses into themes.",
        "Deciding which employee gets promoted this cycle.",
        "Drafting the promotion announcement once the decision is made.",
      ],
      answer: 2,
      feedback: {
        correct:
          "Yes. Choosing who is a high-stakes people decision needing a human owner and defensible reasoning. Note the last option, announcing the decision, is happily AI-lead.",
        incorrect:
          "Not quite. Rewriting, summarizing, and announcing are all safe AI or hybrid work. Deciding who gets promoted is the human-lead call.",
      },
    },
    grillBeat: {
      prompt: "For which task is human judgment irreplaceable, and why?",
      branches: [
        {
          choice: "The people decisions (promotions, a PIP), they carry fairness, legal, and human weight.",
          retort:
            "Exactly. A pattern-predictor can't be accountable for a decision about a person's livelihood.",
        },
        {
          choice: "Drafting the announcement email after the decision.",
          retort:
            "That one's fine for AI. The irreplaceable judgment is the people decision itself, not writing it up afterwards.",
        },
      ],
    },
  },
];
