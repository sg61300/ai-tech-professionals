"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Lesson } from "@/content/schema";
import { completeLesson, type CompleteLessonResult } from "@/app/(app)/learn/lesson/[id]/actions";
import "./lesson.css";

/**
 * LessonRunner — the immersive lesson experience (PRD/05 shape):
 * read blocks -> one auto-graded exercise -> scripted grill-me beat ->
 * celebration. Back + home controls on every step (Session 07 rule). The
 * completion write is a server action; this island only drives the flow.
 */

type Phase = "read" | "exercise" | "grill" | "done";

const toneEmoji: Record<string, string> = { info: "💡", tip: "✅", warn: "⚠️", ai: "🤖" };

/**
 * Minimal, safe inline markdown for lesson copy: **bold** and *italic* only
 * (the two forms our authored content uses). Builds React nodes, never HTML,
 * so there's no injection surface.
 */
function Md({ children }: { children: string }): ReactNode {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(children))) {
    if (m.index > last) out.push(children.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={k++}>{m[1]}</strong>);
    else out.push(<em key={k++}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < children.length) out.push(children.slice(last));
  return <>{out}</>;
}

export function LessonRunner({
  lesson,
  completeAction = completeLesson,
}: {
  lesson: Lesson;
  /** Injectable seam so the dev-preview harness can stub the DB write (mirrors OnboardingFlow). */
  completeAction?: (lessonId: string, correct: boolean) => Promise<CompleteLessonResult>;
}) {
  const router = useRouter();
  const hasGrill = !!lesson.grillBeat;

  const [phase, setPhase] = useState<Phase>("read");
  const [picked, setPicked] = useState<number | null>(null);
  const [grillPicked, setGrillPicked] = useState<number | null>(null);
  const [result, setResult] = useState<CompleteLessonResult | null>(null);
  const [saving, setSaving] = useState(false);

  // Answer index for the tap-one-option exercises (mcq). Order/fill aren't used
  // in Unit 1; they fall through as "no single index" and never mark correct.
  const answerIndex = lesson.exercise.kind === "mcq" ? lesson.exercise.answer : -1;
  const correct = picked === answerIndex;

  const steps: Phase[] = ["read", "exercise", ...(hasGrill ? (["grill"] as Phase[]) : []), "done"];
  const stepIndex = steps.indexOf(phase);
  const progress = stepIndex / (steps.length - 1);

  async function finish() {
    setSaving(true);
    const r = await completeAction(lesson.id, correct);
    setResult(r);
    setSaving(false);
    setPhase("done");
  }

  function goNext() {
    if (phase === "read") setPhase("exercise");
    else if (phase === "exercise") setPhase(hasGrill ? "grill" : "done");
    else if (phase === "grill") void finish();
  }

  function goBack() {
    if (phase === "read") router.push("/learn");
    else if (phase === "exercise") setPhase("read");
    else if (phase === "grill") setPhase("exercise");
  }

  // Read phase advances straight from Continue; exercise needs an answer first;
  // grill needs a choice; on the last content step Continue triggers finish().
  const continueLabel =
    phase === "read" ? "Start the exercise" : phase === "grill" ? "Finish lesson" : "Continue";
  // Grill requires the correct branch to finish; a wrong pick shows its retort
  // (why it's off) and lets the learner retry. Correct = the marked branch, else
  // the first (authoring convention).
  const grillCorrect = lesson.grillBeat
    ? Math.max(0, lesson.grillBeat.branches.findIndex((b) => b.correct))
    : 0;
  const grillSolved = grillPicked === grillCorrect;
  const canContinue =
    phase === "read" ? true : phase === "exercise" ? picked !== null : grillSolved;

  return (
    <div className="lr">
      <header className="lr-top">
        <button className="lr-icon" onClick={goBack} aria-label="Back">
          ←
        </button>
        <div className="lr-bar">
          <i style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <button className="lr-icon" onClick={() => router.push("/learn")} aria-label="Home">
          🏠
        </button>
      </header>

      <main className="lr-body">
        {phase === "read" && (
          <section className="lr-read">
            <p className="lr-kicker">Unit {lesson.unit} · Lesson</p>
            <h1 className="lr-title">{lesson.title}</h1>
            {lesson.blocks.map((b, i) =>
              b.type === "text" ? (
                <p key={i} className="lr-md">
                  <Md>{b.md}</Md>
                </p>
              ) : b.type === "callout" ? (
                <div key={i} className={`lr-callout ${b.tone}`}>
                  <span className="lr-callout-ic">{toneEmoji[b.tone]}</span>
                  <p className="lr-md">
                    <Md>{b.md}</Md>
                  </p>
                </div>
              ) : b.type === "quote" ? (
                <blockquote key={i} className="lr-quote">
                  <p className="lr-md">
                    <Md>{b.md}</Md>
                  </p>
                  {b.by && <cite>{b.by}</cite>}
                </blockquote>
              ) : (
                // image
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} className="lr-img" src={b.src} alt={b.alt} />
              ),
            )}
          </section>
        )}

        {phase === "exercise" && (
          <section className="lr-ex">
            <p className="lr-kicker">Quick check</p>
            <h2 className="lr-q">{lesson.exercise.prompt}</h2>
            <div className="lr-opts">
              {optionList(lesson).map((opt, i) => {
                const chosen = picked === i;
                const isAnswer = i === answerIndex;
                const revealed = picked !== null;
                const cls = revealed
                  ? isAnswer
                    ? "right"
                    : chosen
                      ? "wrong"
                      : "dim"
                  : "";
                return (
                  <button
                    key={i}
                    className={`lr-opt ${cls}`}
                    disabled={revealed}
                    onClick={() => setPicked(i)}
                  >
                    {opt}
                    {revealed && isAnswer && <span className="lr-tick">✓</span>}
                    {revealed && chosen && !isAnswer && <span className="lr-tick">✕</span>}
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <div className={`lr-feedback ${correct ? "good" : "bad"}`}>
                {correct ? lesson.exercise.feedback.correct : lesson.exercise.feedback.incorrect}
              </div>
            )}
          </section>
        )}

        {phase === "grill" && lesson.grillBeat && (
          <section className="lr-grill">
            <p className="lr-kicker">🔥 Grill me</p>
            <h2 className="lr-q">{lesson.grillBeat.prompt}</h2>
            <div className="lr-opts">
              {lesson.grillBeat.branches.map((br, i) => (
                <button
                  key={i}
                  className={`lr-opt ${
                    grillSolved && i === grillCorrect
                      ? "right"
                      : grillPicked === i && i !== grillCorrect
                        ? "wrong"
                        : ""
                  }`}
                  disabled={grillSolved}
                  onClick={() => setGrillPicked(i)}
                >
                  {br.choice}
                  {grillSolved && i === grillCorrect && <span className="lr-tick">✓</span>}
                </button>
              ))}
            </div>
            {grillPicked !== null && (
              <div className={`lr-retort${grillSolved ? "" : " bad"}`}>
                {!grillSolved && <b>Not quite. </b>}
                {lesson.grillBeat.branches[grillPicked].retort}
              </div>
            )}
          </section>
        )}

        {phase === "done" && (
          <section className="lr-done">
            <div className="lr-rune-hop">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mascot/rune-hero-clean.png" alt="Rune celebrating" />
            </div>
            <h1 className="lr-done-title">Lesson complete!</h1>
            {result && result.ok ? (
              <>
                {result.alreadyDone ? (
                  <p className="lr-done-sub">You&apos;d already mastered this one. Nice refresher.</p>
                ) : (
                  <div className="lr-rewards">
                    <span className="lr-reward xp">+{result.xpAwarded} XP</span>
                    {result.leveledUp && <span className="lr-reward lvl">Level {result.newLevel}!</span>}
                    {result.streakAdvanced && (
                      <span className="lr-reward streak">🔥 {result.streak}-day streak</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="lr-done-sub">
                Saved locally. {result && !result.ok ? "(Sync will retry.)" : ""}
              </p>
            )}
            <button className="lr-cta" onClick={() => router.push("/learn")}>
              Back to your path
            </button>
          </section>
        )}
      </main>

      {phase !== "done" && (
        <footer className="lr-foot">
          <button className="lr-cta" disabled={!canContinue || saving} onClick={goNext}>
            {saving ? "Saving…" : continueLabel}
          </button>
        </footer>
      )}
    </div>
  );
}

function optionList(lesson: Lesson): string[] {
  const ex = lesson.exercise;
  if (ex.kind === "mcq") return ex.options;
  if (ex.kind === "order") return ex.items;
  return ex.accept; // fill — not used in Unit 1, shown for completeness
}
