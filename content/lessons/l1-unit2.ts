import type { Lesson } from "@/content/schema";

/**
 * Level 1, Unit 2 — "The HR Daily Toolkit" (Lessons 6-10).
 * Authored from PRD/06. Same shape/voice as Unit 1: Hook -> concept cards ->
 * quick-win -> one auto-graded exercise -> scripted grill-me beat.
 *
 * House rule (Session 07): no em dashes in learner-facing copy (commas instead).
 * PRD "pick-better-output" and "fix-prompt" exercises are both modelled as the
 * schema's constrained `mcq` (the ✅ option sits at `answer`).
 *
 * Seniority seam (settled decision): a few lessons carry an optional `flavor`
 * with a per-level example line; the runner shows it as a "for your level"
 * note. Purely additive, so the path is the same for everyone.
 */
export const L1_UNIT2: Lesson[] = [
  {
    id: "l6",
    unit: 2,
    title: "Inbox triage",
    blocks: [
      {
        type: "text",
        md: "Your inbox is a to-do list written entirely by other people. Let's take it back. AI can sort a pile of emails by urgency and importance in seconds, *if* you tell it what \"urgent\" means in your world.",
      },
      {
        type: "text",
        md: "**Feed it your rules.** Resignation? Escalation? CEO? Straight to the top. Lunch poll, newsletter, \"just FYI\"? Later. Hand AI the criteria and it becomes a tireless sorting assistant that never sighs.",
      },
      {
        type: "callout",
        tone: "warn",
        md: "**But you own the priorities.** AI doesn't know a quiet \"I'd like to discuss my role\" email may matter more than ten loud ones. You set the ranking, it does the grunt work.",
      },
      {
        type: "callout",
        tone: "ai",
        md: "**Try it.** \"Here are 12 email subject lines plus first lines. Sort them into Now / Today / This week / Ignore. Treat resignations, escalations, and leadership requests as top priority. One line each on why.\"",
      },
    ],
    exercise: {
      kind: "mcq",
      prompt: "Which prompt triages your inbox better?",
      options: [
        "\"Sort my emails.\"",
        "\"Sort these emails into Now / Today / This week using these priorities: exits and escalations first, employee issues next, FYIs last.\"",
      ],
      answer: 1,
      feedback: {
        correct:
          "Yes. Triage without stated criteria is just AI guessing your priorities, and it guesses blandly. Give it the rules.",
        incorrect:
          "Not quite. \"Sort my emails\" leaves AI to invent your priorities. The stronger prompt hands it your ranking rules.",
      },
    },
    grillBeat: {
      prompt: "Why rank this email above that one?",
      branches: [
        {
          choice: "Because my criteria, people-impact, urgency, who's asking, decide priority.",
          retort:
            "Exactly. Your criteria set priority, not the loudness of the subject line.",
        },
        {
          choice: "Because it has more exclamation marks and CAPS.",
          retort:
            "Careful, that's the loudest mail, not the most important. People-impact and urgency are the real ranking, not volume.",
        },
      ],
    },
    flavor: {
      entry:
        "For your level: try it on your own inbox first, sorting your daily employee queries into Now / Today / This week.",
      mid: "For your level: triage a shared team inbox, adding \"anything my manager is cc'd on\" as a Now rule.",
      senior:
        "For your level: sort escalations across your function, flagging board-level or legal-risk items as Now, before your morning stand-up.",
    },
  },
  {
    id: "l7",
    unit: 2,
    title: "Notes to minutes",
    blocks: [
      {
        type: "text",
        md: "Nobody grew up dreaming of writing meeting minutes. Good news, you barely have to anymore. AI's superpower is turning a scrawl of half-sentences into tidy sections: Decisions, Action items, Owners, Deadlines.",
      },
      {
        type: "text",
        md: "**Ask for the shape you want.** Don't accept a grey paragraph. Say \"give me Decisions, Actions (with owner plus date), and Open questions.\" Structure is a request, not a lottery.",
      },
      {
        type: "callout",
        tone: "warn",
        md: "**Watch the tidy-liar.** While \"cleaning up\" notes, AI sometimes invents who agreed to what. Always eyeball the owners and dates before you send, those are the bits people actually act on.",
      },
      {
        type: "callout",
        tone: "ai",
        md: "**Try it.** \"Turn these raw notes into minutes with three sections: Decisions, Action Items (owner plus due date), Open Questions. Flag anything unclear rather than guessing.\"",
      },
    ],
    exercise: {
      kind: "mcq",
      prompt: "Your prompt is \"Summarize these meeting notes.\" Which addition helps most?",
      options: [
        "\"Make it sound smart.\"",
        "\"Structure it as Decisions / Action items (with owners and deadlines) / Open questions, and flag anything ambiguous instead of inventing it.\"",
        "\"Use more emojis.\"",
        "\"Make it longer.\"",
      ],
      answer: 1,
      feedback: {
        correct:
          "Yes. Owners, deadlines, and an \"ambiguous, flag don't invent\" instruction are what make minutes usable, and they guard against the tidy-liar.",
        incorrect:
          "Style and length don't help. What makes minutes usable is structure, owners with deadlines, and a \"flag, don't invent\" guardrail.",
      },
    },
    grillBeat: {
      prompt: "Which action item would AI miss without your judgment?",
      branches: [
        {
          choice: "The implied one, the thing everyone nodded at but nobody said aloud.",
          retort:
            "Right. The unspoken agreement is invisible to AI. Catching it is your job.",
        },
        {
          choice: "The one written in the clearest sentence.",
          retort:
            "That's the easy one AI handles fine. The risk is the implied item nobody stated, which only you heard in the room.",
        },
      ],
    },
  },
  {
    id: "l8",
    unit: 2,
    title: "Presentation outlining",
    blocks: [
      {
        type: "text",
        md: "A blank slide is scarier than a Monday. Let AI break the blank-page freeze for you. Give it the goal plus audience and it hands back a slide-by-slide skeleton in seconds. Starting from *something* beats staring at nothing.",
      },
      {
        type: "text",
        md: "**Story beats confetti.** A clear arc, problem, insight, recommendation, the ask, lands far better than 40 bullet points and a stock photo of people high-fiving.",
      },
      {
        type: "callout",
        tone: "tip",
        md: "**You bring the substance.** AI structures the story. The real data, the org nuance, the \"why this matters here,\" that's all you. It builds the shelves, you stock them.",
      },
      {
        type: "callout",
        tone: "ai",
        md: "**Try it.** \"Outline a 6-slide all-hands deck on our new 2-day WFH policy. Audience: all employees. Goal: explain the change and reduce anxiety. For each slide give a title plus 2 bullets, following problem, what's changing, why, how it works, FAQs, where to ask.\"",
      },
    ],
    exercise: {
      kind: "mcq",
      prompt: "Which prompt gives the better outline?",
      options: [
        "\"Make me a presentation about the WFH policy.\"",
        "\"Outline a 6-slide all-hands deck on the WFH policy, audience: all staff, goal: explain plus reassure, title plus 2 bullets per slide.\"",
      ],
      answer: 1,
      feedback: {
        correct:
          "Yes. Audience, goal, slide count, and per-slide format turn a vague ask into a deck you can actually build on.",
        incorrect:
          "Not quite. A one-line \"make a presentation\" leaves AI guessing. Audience, goal, count, and format are what shape a usable outline.",
      },
    },
    grillBeat: {
      prompt: "Why this order of slides?",
      branches: [
        {
          choice: "Because the audience's questions decide the flow.",
          retort:
            "Agreed. Reassurance-first for a nervous all-hands, data-first for a leadership review. The reader sets the order.",
        },
        {
          choice: "Because that's the default order AI gave me.",
          retort:
            "Don't outsource the call. The order should follow what your specific audience needs to hear first, not a template default.",
        },
      ],
    },
  },
  {
    id: "l9",
    unit: 2,
    title: "Query handling",
    blocks: [
      {
        type: "text",
        md: "Same question, tenth time this week. AI can help you reply with the patience you ran out of on Tuesday. Leave balance, reimbursement steps, \"where's my Form 16?\", AI drafts clear, kind answers fast, so you're not retyping the same reply forever.",
      },
      {
        type: "callout",
        tone: "warn",
        md: "**Ground it in your policy.** Paste the actual (sanitized) policy text so it answers from your rules, not its imagination. Ungrounded, it will confidently invent a leave policy that doesn't exist, and now that's your problem.",
      },
      {
        type: "callout",
        tone: "info",
        md: "**Keep the human for the human moments.** Grievances, exits, anything sensitive: AI can draft, but you add the warmth, the judgment, and the final read. Never auto-send a sensitive reply.",
      },
      {
        type: "callout",
        tone: "ai",
        md: "**Try it.** \"An employee asks how many earned-leave days they have left and how to apply. Using this policy [paste sanitized policy], write a warm, clear reply with the steps. Under 120 words. If the policy doesn't cover something, say so instead of guessing.\"",
      },
    ],
    exercise: {
      kind: "mcq",
      prompt: "Prompt: \"Reply to this employee's leave question.\" Best addition?",
      options: [
        "Paste the actual leave policy plus \"answer only from this; if it's not covered, say so\" plus a warm tone.",
        "\"Sound official.\"",
        "\"Reply in 2 words.\"",
        "\"Add legal disclaimers everywhere.\"",
      ],
      answer: 0,
      feedback: {
        correct:
          "Yes. Grounding in real policy plus a \"don't guess\" guardrail is what keeps the answer both accurate and human.",
        incorrect:
          "Not quite. Tone words and disclaimers don't make it correct. Grounding in the real policy plus a \"don't guess\" rule does.",
      },
    },
    grillBeat: {
      prompt: "Where must a human check the policy before sending?",
      branches: [
        {
          choice: "Anywhere money, leave, or entitlements are stated.",
          retort:
            "Exactly. A wrong number there isn't a typo, it's a promise you'll have to keep.",
        },
        {
          choice: "Only if the employee complains later.",
          retort:
            "Too late by then. Entitlement numbers must be checked before sending, because the reply becomes a commitment the moment it lands.",
        },
      ],
    },
    flavor: {
      entry:
        "For your level: start with the FAQs you answer most, leave, reimbursements, and keep the policy doc open beside you.",
      mid: "For your level: build a small grounded template your team can reuse, so answers stay consistent across everyone's replies.",
      senior:
        "For your level: set the guardrail for your function, which query types may be AI-drafted and which must be human-owned, then socialise it.",
    },
  },
  {
    id: "l10",
    unit: 2,
    title: "When NOT to trust AI",
    blocks: [
      {
        type: "text",
        md: "The most powerful AI skill isn't prompting, it's knowing when to look it in the eye and say \"no, not you.\"",
      },
      {
        type: "callout",
        tone: "warn",
        md: "**Hallucinations: confident and wrong.** AI will invent policies, dates, and even fake legal citations with a completely straight face. Verify anything factual before it leaves your desk, especially in HR, where wrong equals risky.",
      },
      {
        type: "callout",
        tone: "warn",
        md: "**Bias: it echoes what it learned.** Trained on human data, AI can quietly reproduce human bias, gendered job-description language, skewed shortlisting. In HR that's a fairness and legal problem, not a quirk. Read outputs with a bias radar on.",
      },
      {
        type: "callout",
        tone: "info",
        md: "**Confidentiality plus the human line.** Don't feed private employee data into public tools. And any decision *about* a person, hiring, firing, appraisal, needs a human owner who can explain why. If you can't defend the decision, don't ship it.",
      },
    ],
    exercise: {
      kind: "mcq",
      prompt: "Which is the RISKIEST thing to let AI do unchecked?",
      options: [
        "Reword a welcome email to be warmer.",
        "Draft a first outline for a training deck.",
        "Finalize the official reason for an employee's termination.",
        "Suggest synonyms for a job title.",
      ],
      answer: 2,
      feedback: {
        correct:
          "Yes. A people-decision with legal weight needs a human owner and verifiable reasoning, exactly where \"confident but unaccountable\" AI is most dangerous.",
        incorrect:
          "Not the riskiest. Rewording and outlining are safe language jobs. Finalizing a termination reason is a legal people-decision AI must not own.",
      },
    },
    grillBeat: {
      prompt: "What made this output untrustworthy?",
      branches: [
        {
          choice: "An unverifiable fact, a hidden bias, or a decision no human will own.",
          retort:
            "Exactly. Those three, fact, fairness, and accountability, are the trust checklist.",
        },
        {
          choice: "It used slightly formal language.",
          retort:
            "Tone isn't the problem. Untrustworthy means an unverifiable fact, a hidden bias, or a people-decision nobody will stand behind.",
        },
      ],
    },
  },
];
