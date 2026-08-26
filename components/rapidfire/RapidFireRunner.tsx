"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RapidFireSet } from "@/content/schema";
import {
  RF_CONFIG,
  scoreRound,
  isPassed,
  type RfAnswer,
} from "@/lib/rapidfire";
import {
  completeRapidFire,
  type CompleteRapidFireResult,
} from "@/app/(app)/learn/rf/[id]/actions";
import { RuneMascot } from "@/components/brand/RuneMascot";
import "./rapidfire.css";

/**
 * RapidFireRunner — the fast, tap-only recall round (PRD/11). Intro → 8 timed
 * questions (15s each, combo + speed scoring) → pass (celebration + sim-unlock
 * reveal) or a friendly retry. The pure scoring lives in `lib/rapidfire`; this
 * island only drives the flow + timer. The DB write is a server action (fixed
 * XP on the first pass, idempotent).
 *
 * Reduced motion: the animated countdown bar is swapped for a plain numeric
 * timer (PRD/11 accessibility note).
 */

type Phase = "intro" | "playing" | "result";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function RapidFireRunner({
  set,
  completeAction = completeRapidFire,
}: {
  set: RapidFireSet;
  /** Injectable seam for the dev-preview harness (mirrors LessonRunner). */
  completeAction?: (rfId: string, correctCount: number) => Promise<CompleteRapidFireResult>;
}) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("intro");
  const [order, setOrder] = useState<number[]>(() => set.items.map((_, i) => i));
  const [qPos, setQPos] = useState(0); // position within `order`
  const [picked, setPicked] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [answers, setAnswers] = useState<RfAnswer[]>([]);
  const [remaining, setRemaining] = useState<number>(RF_CONFIG.TIMER_MS);
  const [result, setResult] = useState<CompleteRapidFireResult | null>(null);
  const [attempt, setAttempt] = useState(1);

  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const reduceMotion = useRef(false);
  // Synchronous guard so a question is answered exactly once (click vs. timeout
  // race, and React StrictMode's double-invoked updaters). `locked` state still
  // drives the reveal UI; this ref is the source of truth for "already answered".
  const answeredRef = useRef(false);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const item = set.items[order[qPos]];
  const running = useMemo(() => scoreRound(answers), [answers]);
  const isLast = qPos === order.length - 1;

  // --- Answer handling ------------------------------------------------------
  const answer = useCallback(
    (choice: number | null) => {
      if (answeredRef.current) return; // already answered (race / StrictMode)
      answeredRef.current = true;
      const elapsed = choice === null ? RF_CONFIG.TIMER_MS : Date.now() - startRef.current;
      const correct = choice !== null && choice === item.correct;
      setPicked(choice);
      setLocked(true);
      setAnswers((prev) => [...prev, { correct, elapsedMs: elapsed }]);
    },
    [item],
  );

  // --- Countdown timer (rAF) ------------------------------------------------
  useEffect(() => {
    if (phase !== "playing" || locked) return;
    startRef.current = Date.now();
    setRemaining(RF_CONFIG.TIMER_MS);

    const tick = () => {
      const left = RF_CONFIG.TIMER_MS - (Date.now() - startRef.current);
      if (left <= 0) {
        setRemaining(0);
        answer(null); // timeout = miss
        return;
      }
      setRemaining(left);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, qPos, locked, answer]);

  // --- Save once we reach the result screen ---------------------------------
  useEffect(() => {
    if (phase !== "result" || result !== null) return;
    let alive = true;
    void completeAction(set.id, running.correct).then((r) => {
      if (alive) setResult(r);
    });
    return () => {
      alive = false;
    };
  }, [phase, result, completeAction, set.id, running.correct]);

  function next() {
    if (isLast) {
      setPhase("result");
      return;
    }
    setQPos((p) => p + 1);
    setPicked(null);
    setLocked(false);
    answeredRef.current = false;
  }

  function start() {
    setPhase("playing");
  }

  function retry() {
    setOrder(shuffle(set.items.map((_, i) => i)));
    setQPos(0);
    setPicked(null);
    setLocked(false);
    answeredRef.current = false;
    setAnswers([]);
    setResult(null);
    setAttempt((a) => a + 1);
    setPhase("playing");
  }

  const passed = phase === "result" && isPassed(running.correct, set.passThreshold);
  const seconds = Math.ceil(remaining / 1000);
  const timerPct = Math.max(0, (remaining / RF_CONFIG.TIMER_MS) * 100);
  const urgent = remaining <= 5000;

  // ==========================================================================
  if (phase === "intro") {
    return (
      <div className="rf">
        <header className="rf-top">
          <button className="rf-icon" onClick={() => router.push("/learn")} aria-label="Back">
            ←
          </button>
          <span className="rf-top-title">⚡ Rapid Fire</span>
          <span className="rf-icon rf-ghost" aria-hidden />
        </header>
        <main className="rf-intro">
          <div className="rf-bolt" aria-hidden>
            ⚡
          </div>
          <h1 className="rf-h1">{set.title}</h1>
          <p className="rf-intro-copy">{set.intro}</p>
          <ul className="rf-rules">
            <li>
              <b>{set.items.length}</b> questions · tap only
            </li>
            <li>
              <b>{RF_CONFIG.TIMER_MS / 1000}s</b> each · speed &amp; combo bonuses
            </li>
            <li>
              Pass at <b>{set.passThreshold}/{set.items.length}</b> · retry free &amp; unlimited
            </li>
          </ul>
          <button className="rf-cta" onClick={start}>
            Go! →
          </button>
        </main>
      </div>
    );
  }

  // ==========================================================================
  if (phase === "playing") {
    const revealed = locked;
    return (
      <div className="rf">
        <header className="rf-top">
          <button className="rf-icon" onClick={() => router.push("/learn")} aria-label="Quit">
            ✕
          </button>
          <span className="rf-count">
            {qPos + 1} / {order.length}
          </span>
          <span className={`rf-combo${running.combo >= 3 ? " on" : ""}`}>
            {running.combo >= 2 ? `💥 ${running.combo}` : ""}
          </span>
        </header>

        <div className="rf-timer-row">
          <span className={`rf-secs${urgent ? " urgent" : ""}`} aria-live="polite">
            {revealed ? "✓" : `${seconds}s`}
          </span>
          <div className={`rf-timer${urgent ? " urgent" : ""}${reduceMotion.current ? " reduced" : ""}`}>
            {!reduceMotion.current && <i style={{ width: `${revealed ? 100 : timerPct}%` }} />}
          </div>
        </div>

        <main className="rf-play">
          <p className="rf-kicker">
            Question {qPos + 1}
            {item.grillStyle ? " · 🔥 judgment call" : ""}
          </p>
          <h2 className="rf-q">{item.prompt}</h2>

          <div className={`rf-opts${item.kind === "truefalse" ? " tf" : ""}`}>
            {item.options.map((opt, i) => {
              const isAnswer = i === item.correct;
              const chosen = picked === i;
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
                  className={`rf-opt ${cls}`}
                  disabled={revealed}
                  onClick={() => answer(i)}
                >
                  <span>{opt}</span>
                  {revealed && isAnswer && <span className="rf-tick">✓</span>}
                  {revealed && chosen && !isAnswer && <span className="rf-tick">✕</span>}
                </button>
              );
            })}
          </div>

          {revealed && (
            <div className={`rf-teach${picked === item.correct ? " good" : " bad"}`}>
              <b>{picked === item.correct ? "Nailed it. " : "Heads up. "}</b>
              {item.teach}
            </div>
          )}
        </main>

        {revealed && (
          <footer className="rf-foot">
            <button className="rf-cta" onClick={next}>
              {isLast ? "See results →" : "Next →"}
            </button>
          </footer>
        )}
      </div>
    );
  }

  // ========================================================================== result
  return (
    <div className="rf">
      <main className={`rf-result${passed ? " pass" : " fail"}`}>
        {passed ? (
          <>
            <div className="rune-cel">
              <RuneMascot state="celebrate" spriteSrc="/mascot/rune-hero-clean.png" dimensions={168} />
            </div>
            <h1 className="rf-h1">🔥 Rapid Fire cleared!</h1>
            <div className="rf-tally">
              <span className="rf-stat">
                <b>{running.correct}/{order.length}</b>
                <small>correct</small>
              </span>
              <span className="rf-stat">
                <b>{running.score}</b>
                <small>round score</small>
              </span>
              <span className="rf-stat">
                <b>×{running.bestCombo}</b>
                <small>best combo</small>
              </span>
            </div>

            {result && result.ok ? (
              result.alreadyDone ? (
                <p className="rf-sub">Already cleared before, sharp as ever.</p>
              ) : (
                <div className="rf-rewards">
                  <span className="rf-reward xp">+{result.xpAwarded} XP</span>
                  {result.leveledUp && <span className="rf-reward lvl">Tier {result.newLevel}!</span>}
                  {result.streakAdvanced && (
                    <span className="rf-reward streak">🔥 {result.streak}-day streak</span>
                  )}
                </div>
              )
            ) : (
              <p className="rf-sub">{result ? "Saved. (Sync will retry.)" : "Saving…"}</p>
            )}

            {set.unlocksSimId && (
              <div className="rf-unlock">
                <span className="rf-unlock-ic">📧</span>
                <div>
                  <b>New unlocked: your first full simulation</b>
                  <small>Head back to the path. The AI Hub is live.</small>
                </div>
              </div>
            )}

            <button className="rf-cta" onClick={() => router.push("/learn")}>
              Back to your path →
            </button>
          </>
        ) : (
          <>
            <div className="rune-cel">
              <RuneMascot state="grill" spriteSrc="/mascot/rune-hero-clean.png" dimensions={150} />
            </div>
            <h1 className="rf-h1">
              {running.correct}/{order.length}, so close
            </h1>
            <p className="rf-sub">
              You need {set.passThreshold} to clear it. Round {attempt + 1}, you&apos;ve got this.
              No hearts, no penalty, questions reshuffle.
            </p>
            <button className="rf-cta" onClick={retry}>
              Retry round →
            </button>
            <button className="rf-link" onClick={() => router.push("/learn")}>
              Back to path
            </button>
          </>
        )}
      </main>
    </div>
  );
}
