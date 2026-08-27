"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TasteSim } from "@/content/schema";
import {
  generateTasteEmail,
  completeTasteSim,
  type TasteGenResult,
  type TasteCompleteResult,
} from "@/app/(app)/learn/sim/[id]/actions";
import { RuneLoader } from "@/components/brand/RuneLoader";
import { RuneMascot } from "@/components/brand/RuneMascot";
import "@/components/lesson/lesson.css";
import "./sim.css";

/**
 * TasteSimRunner — the guided 4-part-prompt builder (PRD/08). Role -> context
 * chips -> format toggles -> assembled review -> live Gemini generation (with
 * the scripted fallback the server guarantees) -> celebration + grill. The
 * generate/complete writes are server actions; both are injectable so the
 * dev-preview harness can run the whole flow without auth.
 */

type Step = "intro" | "role" | "context" | "format" | "review" | "generating" | "result" | "celebrate";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function TasteSimRunner({
  sim,
  generateAction = generateTasteEmail,
  completeAction = completeTasteSim,
}: {
  sim: TasteSim;
  generateAction?: (input: unknown) => Promise<TasteGenResult>;
  completeAction?: () => Promise<TasteCompleteResult>;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [roleIndex, setRoleIndex] = useState<number | null>(null);
  const [wrongRole, setWrongRole] = useState<{ preview?: string; nudge?: string } | null>(null);
  const [facts, setFacts] = useState<Set<number>>(new Set());
  const [distractorWarn, setDistractorWarn] = useState<string | null>(null);
  const [toggles, setToggles] = useState<Set<number>>(
    () => new Set(sim.format.toggles.map((t, i) => (t.recommended ? i : -1)).filter((i) => i >= 0)),
  );
  const [gen, setGen] = useState<TasteGenResult | null>(null);
  const [reveal, setReveal] = useState(0);
  const [grillPicked, setGrillPicked] = useState<number | null>(null);
  const [completion, setCompletion] = useState<TasteCompleteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const emailText = gen && gen.ok ? gen.text : "";

  // Typewriter reveal of the generated email.
  useEffect(() => {
    if (step !== "result" || !emailText) return;
    if (prefersReducedMotion()) {
      setReveal(emailText.length);
      return;
    }
    setReveal(0);
    const id = setInterval(() => {
      setReveal((r) => {
        if (r >= emailText.length) {
          clearInterval(id);
          return r;
        }
        return Math.min(emailText.length, r + 3);
      });
    }, 16);
    return () => clearInterval(id);
  }, [step, emailText]);

  function pickRole(i: number) {
    const opt = sim.role.options[i];
    if (opt.correct) {
      setRoleIndex(i);
      setWrongRole(null);
    } else {
      setWrongRole({ preview: opt.preview, nudge: opt.nudge });
    }
  }
  function toggleFact(i: number) {
    setFacts((s) => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  }
  function toggleFmt(i: number) {
    setToggles((s) => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  }

  async function generate() {
    setStep("generating");
    const sel = {
      roleIndex,
      factIndices: [...facts],
      toggleIndices: [...toggles],
    };
    const r = await generateAction(sel);
    setGen(r);
    setStep("result");
  }

  async function finish() {
    const c = await completeAction();
    setCompletion(c);
    setStep("celebrate");
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(emailText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  // Assembling prompt bar shown across the build steps.
  const roleTxt = roleIndex !== null ? sim.role.options[roleIndex].value : "___";
  const ctxTxt = facts.size ? [...facts].map((i) => sim.context.facts[i].label).join(", ") : "___";
  const fmtTxt = toggles.size ? [...toggles].map((i) => sim.format.toggles[i].value).join(", ") : "___";

  const STEPS: Step[] = ["intro", "role", "context", "format", "review", "generating", "result", "celebrate"];
  const progress = STEPS.indexOf(step) / (STEPS.length - 1);

  function back() {
    const order: Step[] = ["intro", "role", "context", "format", "review"];
    const i = order.indexOf(step);
    if (i <= 0) router.push("/learn");
    else setStep(order[i - 1]);
  }

  return (
    <div className="lr ts">
      {step !== "celebrate" && step !== "generating" && (
        <header className="lr-top">
          <button className="lr-icon" onClick={back} aria-label="Back">
            ←
          </button>
          <div className="lr-bar">
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </header>
      )}

      {/* Assembling prompt bar */}
      {(step === "role" || step === "context" || step === "format") && (
        <div className="ts-bar">
          <span className="ts-part">
            You are <b>{roleTxt}</b>.
          </span>{" "}
          <span className="ts-part">
            Situation: <b>{ctxTxt}</b>.
          </span>{" "}
          <span className="ts-part">
            Format: <b>{fmtTxt}</b>.
          </span>
        </div>
      )}

      <main className="lr-body">
        {step === "intro" && (
          <section className="lr-done" style={{ minHeight: "60dvh" }}>
            <div className="rune-cel">
              <RuneMascot state="greet" spriteSrc="/mascot/rune-hero-clean.png" dimensions={168} />
            </div>
            <p className="lr-kicker">Taste Sim</p>
            <h1 className="lr-done-title">Ship your first AI draft</h1>
            <p className="lr-done-sub">{sim.intro.copy}</p>
            <button className="lr-cta" style={{ maxWidth: "20rem" }} onClick={() => setStep("role")}>
              {sim.intro.cta}
            </button>
          </section>
        )}

        {step === "role" && (
          <section>
            <p className="lr-kicker">Step 1 · Role</p>
            <h2 className="lr-q">{sim.role.copy}</h2>
            <div className="lr-opts">
              {sim.role.options.map((o, i) => (
                <button
                  key={i}
                  className={`lr-opt ${roleIndex === i ? "right" : ""}`}
                  onClick={() => pickRole(i)}
                >
                  {o.label}
                  {roleIndex === i && <span className="lr-tick">✓</span>}
                </button>
              ))}
            </div>
            {wrongRole && (
              <div className="lr-feedback bad">
                {wrongRole.preview && <em>&ldquo;{wrongRole.preview}&rdquo;</em>}
                <div>{wrongRole.nudge}</div>
              </div>
            )}
            {roleIndex !== null && <div className="ts-beat">{sim.role.decisionBeat}</div>}
          </section>
        )}

        {step === "context" && (
          <section>
            <p className="lr-kicker">Step 2 · Context</p>
            <h2 className="lr-q">{sim.context.copy}</h2>
            <div className="ts-chips">
              {sim.context.facts.map((f, i) => (
                <button
                  key={`f${i}`}
                  className={`ts-chip ${facts.has(i) ? "on" : ""}`}
                  onClick={() => toggleFact(i)}
                >
                  {facts.has(i) ? "✓ " : "+ "}
                  {f.label}
                </button>
              ))}
              {sim.context.distractors.map((d, i) => (
                <button
                  key={`d${i}`}
                  className="ts-chip distractor"
                  onClick={() => setDistractorWarn(d.warning)}
                >
                  + {d.label}
                </button>
              ))}
            </div>
            {distractorWarn && <div className="lr-feedback bad">⚠️ {distractorWarn}</div>}
            <div className="ts-count">
              {facts.size} / {sim.context.minSelect} selected
              {facts.size >= sim.context.minSelect ? " ✓" : ` (pick at least ${sim.context.minSelect})`}
            </div>
            {facts.size >= sim.context.minSelect && <div className="ts-beat">{sim.context.decisionBeat}</div>}
          </section>
        )}

        {step === "format" && (
          <section>
            <p className="lr-kicker">Step 3 · Format</p>
            <h2 className="lr-q">{sim.format.copy}</h2>
            <div className="lr-opts">
              {sim.format.toggles.map((t, i) => (
                <button
                  key={i}
                  className={`lr-opt ${toggles.has(i) ? "chosen" : ""}`}
                  onClick={() => toggleFmt(i)}
                >
                  {toggles.has(i) ? "✓ " : ""}
                  {t.label}
                  {t.recommended && <span className="ts-rec">recommended</span>}
                </button>
              ))}
            </div>
            <div className="ts-beat">{sim.format.decisionBeat}</div>
          </section>
        )}

        {step === "review" && (
          <section>
            <p className="lr-kicker">Your prompt</p>
            <h2 className="lr-q">{sim.assembled.preface}</h2>
            <div className="ts-review">
              <span className="ts-tag role">Role</span> You are {roleTxt}.{" "}
              <span className="ts-tag ctx">Context</span> A new joinee, Ananya Sharma (Marketing
              Associate), {[...facts].map((i) => sim.context.facts[i].value).join("; ") || "..."}.{" "}
              <span className="ts-tag task">Task</span> {sim.assembled.task}{" "}
              <span className="ts-tag fmt">Format</span>{" "}
              {[...toggles].map((i) => sim.format.toggles[i].value).join(", ") || "..."}.
            </div>
          </section>
        )}

        {step === "generating" && (
          <section className="lr-done" style={{ minHeight: "70dvh" }}>
            <RuneLoader size={180} />
            <p className="lr-done-sub">Rune is tuning your email...</p>
          </section>
        )}

        {step === "result" && (
          <section>
            <p className="lr-kicker">
              ✨ Your AI draft{gen && gen.ok && gen.source === "fallback" ? " (sample)" : ""}
            </p>
            <pre className="ts-email">{emailText.slice(0, reveal)}</pre>
          </section>
        )}

        {step === "celebrate" && (
          <section className="lr-done">
            <div className="rune-cel">
              <RuneMascot state="celebrate" spriteSrc="/mascot/rune-hero-clean.png" dimensions={168} />
            </div>
            <h1 className="lr-done-title">You shipped it! 🎉</h1>
            <p className="lr-done-sub">{sim.celebration.copy}</p>
            {completion && completion.ok && (
              <div className="lr-rewards">
                {completion.alreadyDone ? (
                  <span className="lr-reward">Already earned</span>
                ) : (
                  <>
                    <span className="lr-reward xp">+{completion.xpAwarded} XP</span>
                    <span className="lr-reward lvl">🏅 {completion.badge}</span>
                    {completion.streakAdvanced && (
                      <span className="lr-reward streak">🔥 {completion.streak}-day streak</span>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Invitee referral bonus: a friend's code got them here, so both sides
                earned XP. Only shows when a payout actually happened. */}
            {completion && completion.ok && !completion.alreadyDone && completion.referralXp > 0 && (
              <p className="lr-refbonus">
                🎁 <b>+{completion.referralXp} bonus.</b> You and your friend both earned it.
              </p>
            )}

            <div className="ts-grill">
              <p className="lr-kicker">🔥 {sim.grillBeat.prompt}</p>
              <div className="lr-opts">
                {sim.grillBeat.branches.map((b, i) => (
                  <button
                    key={i}
                    className={`lr-opt ${grillPicked === i ? "chosen" : grillPicked !== null ? "dim" : ""}`}
                    disabled={grillPicked !== null}
                    onClick={() => setGrillPicked(i)}
                  >
                    {b.choice}
                  </button>
                ))}
              </div>
              {grillPicked !== null && <div className="lr-retort">{sim.grillBeat.branches[grillPicked].retort}</div>}
            </div>

          </section>
        )}
      </main>

      {/* Footer CTA per build step */}
      {step === "role" && (
        <Foot disabled={roleIndex === null} label="Add the context" onClick={() => setStep("context")} />
      )}
      {step === "context" && (
        <Foot
          disabled={facts.size < sim.context.minSelect}
          label="Choose the format"
          onClick={() => setStep("format")}
        />
      )}
      {step === "format" && <Foot label="Review your prompt" onClick={() => setStep("review")} />}
      {step === "review" && <Foot label={sim.assembled.cta} onClick={generate} />}
      {step === "result" && <Foot label="See your reward" onClick={finish} />}
      {step === "celebrate" && (
        <footer className="lr-foot lr-foot-cel">
          <button type="button" className="lr-copy" onClick={copyEmail}>
            {copied ? "Copied ✓" : "📋 Copy email"}
          </button>
          <button type="button" className="lr-cta" onClick={() => router.push("/learn")}>
            Done
          </button>
        </footer>
      )}
    </div>
  );
}

function Foot({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  const router = useRouter();
  return (
    <footer className="lr-foot">
      <button className="lr-cta" disabled={disabled} onClick={onClick}>
        {label}
      </button>
      <button className="lr-home" onClick={() => router.push("/learn")}>
        🏠 Home
      </button>
    </footer>
  );
}
