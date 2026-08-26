import type { Lesson } from "@/content/schema";

/**
 * Level 1, Unit 1 — "Foundations & First Wins" (Lessons 1-5).
 * Authored from PRD/05. Voice: warm, jargon-free, lightly witty, Indian-HR
 * context. Each lesson: Hook -> concept cards -> quick-win -> one auto-graded
 * exercise -> scripted grill-me beat -> takeaway.
 *
 * House rule (Session 07): no em dashes in learner-facing copy (commas instead).
 * Exercise mapping: PRD "fix-a-weak-prompt" and "pick-better-output" are both
 * modelled as constrained `mcq` (the schema's auto-graded shapes).
 */
export const L1_UNIT1: Lesson[] = [
  {
    id: "l1",
    unit: 1,
    title: "What AI really is (and isn't)",
    blocks: [
      {
        type: "text",
        md: "You've heard AI might \"take your job.\" Plot twist: the people who *understand* it tend to take the jobs of the people who *fear* it. Let's get you firmly in the first group, starting with what this thing actually is.",
      },
      {
        type: "text",
        md: "**It's autocomplete that went to university.** An LLM learned from mountains of text to predict the next words. It doesn't \"know\" things, it makes very educated guesses. Picture a colleague who has read a million books but never once set foot in your office: dazzling with words, clueless about your world until you brief them.",
      },
      {
        type: "callout",
        tone: "warn",
        md: "**Why that matters for HR.** Give it a *language* job (rewrite, summarize, draft) and it shines. Ask it about your leave policy or Priya's attendance and it may cheerfully invent an answer (a **hallucination**). A confidently wrong policy reply isn't cute, it's a legal headache.",
      },
      {
        type: "callout",
        tone: "info",
        md: "**What it is NOT.** Not your replacement. Not a source of truth about your org. Not a vault, so never paste confidential employee data into public AI tools. Think talented intern: drafts fast, fact-checks never.",
      },
      {
        type: "callout",
        tone: "ai",
        md: "**Try it.** \"Rewrite this to be warm and professional, 3 sentences max: 'Hey, you didn't submit your timesheet again, do it now.'\" A curt nudge becomes something you'd actually send.",
      },
    ],
    exercise: {
      kind: "mcq",
      prompt: "Which statement about AI (LLMs) is TRUE?",
      options: [
        "It looks up facts in a live, verified database to answer you.",
        "It predicts likely text from patterns it learned, and can sound confident even when wrong.",
        "It automatically knows your company's HR policies.",
        "It always tells the truth.",
      ],
      answer: 1,
      feedback: {
        correct:
          "Exactly. An LLM generates plausible-sounding language, it isn't retrieving verified facts. Fluency is not accuracy, which is why your judgment matters.",
        incorrect:
          "Not quite. An LLM predicts plausible text from patterns, it doesn't look up verified facts, so it can sound confident and still be wrong.",
      },
    },
    grillBeat: {
      prompt: "Why is AI confident but sometimes wrong?",
      branches: [
        {
          choice: "Because it predicts text that sounds right, not something verified right.",
          retort: "Spot on. Confidence is a style, not a guarantee. Verify anything factual.",
        },
        {
          choice: "Because it is lazy or careless.",
          retort:
            "Not really. It isn't careless, it's predicting the most likely next words. Sounding right is not the same as being right.",
        },
      ],
    },
  },
  {
    id: "l2",
    unit: 1,
    title: "Anatomy of a great prompt",
    blocks: [
      {
        type: "text",
        md: "Same AI, wildly different results, and the difference is almost always the *prompt*, not the tool. Translation: the problem is usually us, not the robot. Wonderfully fixable.",
      },
      {
        type: "text",
        md: "**The 4-part prompt.** Brief AI like a new hire using four blanks: **Role** (who to be), **Context** (what's going on), **Task** (what to do), **Format** (how to serve it). Miss one and AI fills the gap with guesswork, usually beige, generic guesswork.",
      },
      {
        type: "callout",
        tone: "tip",
        md: "**Weak vs strong.** \"Write a leave policy email\" is beige and off-tone. Compare: \"You are an HR manager. Our Bengaluru team is confused about the new 2-day WFH policy. Write a short, friendly announcement explaining it and where to ask questions. Under 120 words, warm tone.\" Usable on the first try.",
      },
      {
        type: "callout",
        tone: "ai",
        md: "**Your reusable skeleton:** \"You are [role]. Situation: [context]. Please [task]. Format: [format].\" Four blanks filled, and most daily HR prompts suddenly behave.",
      },
    ],
    exercise: {
      kind: "mcq",
      prompt:
        "The weak prompt is: \"Write a job description for an HR Manager.\" Which single addition would improve it MOST?",
      options: [
        "Add \"please\" to be polite.",
        "Add context and format: the seniority, must-have skills, location, and \"return 5 bullet responsibilities plus 4 required qualifications.\"",
        "Make it longer by repeating the request.",
        "Ask it in all capital letters.",
      ],
      answer: 1,
      feedback: {
        correct:
          "Yes. Specifics (context) and a defined output shape (format) turn a generic wall of text into a usable JD.",
        incorrect:
          "Politeness and length don't help. What's missing is context (seniority, skills, location) and a defined format.",
      },
    },
    grillBeat: {
      prompt: "Which part did the weak prompt miss, and why did that matter?",
      branches: [
        {
          choice: "It gave only a Task, with no Role, Context, or Format.",
          retort:
            "Right. With no Role, Context, or Format, AI had to guess the seniority, skills, and shape, and guessed generically.",
        },
        {
          choice: "It missed the greeting and sign-off.",
          retort:
            "Those aren't the lever. The real gaps were Role, Context, and Format, the parts that steer the output.",
        },
      ],
    },
    flavor: {
      entry:
        "For your level: try the 4-part skeleton on a real task this week, like drafting an interview-invite email.",
      mid: "For your level: use it to brief AI on a policy note your team will send, spelling out audience and tone up front.",
      senior:
        "For your level: set the Role and Context once for a recurring comms task, then hand the skeleton to your team as a standard.",
    },
  },
  {
    id: "l3",
    unit: 1,
    title: "Context is everything",
    blocks: [
      {
        type: "text",
        md: "AI doesn't know your company, your people, or that Rahul from Payroll takes *everything* personally, unless you tell it. Context is the difference between a generic draft and *your* draft.",
      },
      {
        type: "text",
        md: "**Context is what only you know.** AI hasn't read your intranet, sat in your meetings, or met your CEO. Everything obvious to you is a mystery to it. Spell out the background, or enjoy a confidently generic draft.",
      },
      {
        type: "callout",
        tone: "tip",
        md: "**The context checklist.** Before you hit enter: Who's reading? What tone? Any policy? A document to use? An example of \"good\"? Even one answer upgrades the output.",
      },
      {
        type: "callout",
        tone: "ai",
        md: "**Try it.** \"Rewrite this policy update three ways for three audiences: (1) a new joinee, (2) a senior director, (3) an all-staff announcement. Keep each under 80 words and match the tone to each reader.\" Same task, three tones, context decides.",
      },
    ],
    exercise: {
      kind: "mcq",
      prompt:
        "You ask: \"Draft a rejection email for a candidate.\" Which addition improves it MOST?",
      options: [
        "Context: the role applied for, that they interviewed and were strong, and to keep the door open for future roles, in a warm, respectful tone.",
        "Tell it to write faster.",
        "Ask for it in Comic Sans.",
        "Add \"ASAP\" at the end.",
      ],
      answer: 0,
      feedback: {
        correct:
          "Yes. The stage they reached, the intent (keep the relationship), and the tone are context only you have, and they change the whole email.",
        incorrect:
          "Speed and fonts don't matter here. The candidate's stage, your intent, and the tone are the context that reshapes the email.",
      },
    },
    grillBeat: {
      prompt: "What context changed the output most?",
      branches: [
        {
          choice: "The audience and intent.",
          retort:
            "Agreed. Audience and intent reshape tone and content more than any wording tweak.",
        },
        {
          choice: "The word count.",
          retort:
            "Length trims it, but audience and intent are what actually change what the email says and how it lands.",
        },
      ],
    },
  },
  {
    id: "l4",
    unit: 1,
    title: "Tokens & the context window",
    blocks: [
      {
        type: "text",
        md: "Ever notice AI \"forgetting\" what you told it earlier in a long chat? It's not being careless, and it's not passive-aggressive (we promise). Here's the real reason.",
      },
      {
        type: "text",
        md: "**What's a token?** AI reads in bite-sized chunks called **tokens** (about 4 characters each; 1,000 tokens is roughly 750 words). It counts in tokens, not sentences, and yes, it's quietly counting everything you type.",
      },
      {
        type: "callout",
        tone: "info",
        md: "**The context window is AI's working memory.** It's how much AI can hold in view at once. Overflow it and the oldest stuff falls out the back, which is why a marathon chat suddenly \"forgets\" what you agreed 40 messages ago. It just ran out of desk space.",
      },
      {
        type: "callout",
        tone: "tip",
        md: "**Practical moves.** Be concise (cheaper and sharper). Start a fresh chat for a new topic. Summarize the essentials when a thread drags on. A bigger memory isn't automatically a better one: relevant beats long.",
      },
    ],
    exercise: {
      kind: "mcq",
      prompt: "Why does AI seem to forget the start of a very long conversation?",
      options: [
        "It gets bored.",
        "The conversation exceeded its context window, so the oldest tokens were dropped from view.",
        "It deletes your data on purpose.",
        "It only remembers the first message, never the latest.",
      ],
      answer: 1,
      feedback: {
        correct:
          "Right. The window is finite working memory; overflow drops the oldest content first.",
        incorrect:
          "It's not boredom or deletion. The chat overflowed the context window, so the oldest tokens dropped out of view.",
      },
    },
    grillBeat: {
      prompt: "What could you drop from your prompt without losing meaning?",
      branches: [
        {
          choice: "Pleasantries, repeated background, and off-topic history.",
          retort: "Exactly. Keep only what the task truly needs; relevant beats long.",
        },
        {
          choice: "The actual task instructions.",
          retort:
            "Careful, those are the part to keep. Trim pleasantries and repeated background instead, not the task itself.",
        },
      ],
    },
  },
  {
    id: "l5",
    unit: 1,
    title: "Iterating like a pro",
    blocks: [
      {
        type: "text",
        md: "The first answer is a rough draft, not a mic drop. The pros don't write magically better *first* prompts, they just argue with the robot more efficiently.",
      },
      {
        type: "text",
        md: "**AI is a draft partner.** Treat it like an eager junior: quick, willing, occasionally off, and much better after a note or two.",
      },
      {
        type: "callout",
        tone: "tip",
        md: "**The refine loop:** Review, say what's off, ask for one change, repeat. Nudge it; don't rewrite the whole brief every time.",
      },
      {
        type: "callout",
        tone: "ai",
        md: "**Follow-ups worth memorizing:** \"Shorter.\" \"Warmer.\" \"Lose the jargon.\" \"Add a line about X.\" \"Give me 3 options.\" \"Great, just fix the second paragraph.\"",
      },
    ],
    exercise: {
      kind: "mcq",
      prompt:
        "Your draft rejection email is accurate but sounds harsh. Which follow-up best fixes it?",
      options: [
        "\"Write it again.\" (no guidance)",
        "\"Keep the content, but make the tone warmer and add one line thanking them for their time.\" (targeted)",
        "\"Make it longer.\"",
        "\"Add more HR words.\"",
      ],
      answer: 1,
      feedback: {
        correct:
          "Yes. A specific, targeted follow-up tells AI exactly what to change, the essence of iterating.",
        incorrect:
          "Vague or padding follow-ups won't fix tone. Tell AI exactly what to change: keep the content, warm the tone, add a thank-you line.",
      },
    },
    grillBeat: {
      prompt: "Why is the refined version better, tone or content?",
      branches: [
        {
          choice: "Tone, the facts were fine, the delivery needed to match the news.",
          retort:
            "Often true. The content was accurate; warming the delivery is what makes hard news land like a human sent it.",
        },
        {
          choice: "Content, it added new facts.",
          retort:
            "Usually not. The facts were already right here, it was the tone that needed the fix.",
        },
      ],
    },
  },
];
