"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { simBackHref } from "@/lib/sim/backHref";
import type { EmailSim, EmailRule, EmailBucket } from "@/content/schema";
import {
  classifyInbox,
  groupByBucket,
  compilePrompt,
  gradeRulebook,
} from "@/lib/emailsim";
import { RuneLoader } from "@/components/brand/RuneLoader";
import { RuneMascot } from "@/components/brand/RuneMascot";
import { SampleTag } from "./SampleTag";
import {
  narrateSort,
  coachInboxSort,
  completeEmailSim,
  type SortNarrationResult,
  type InboxCoachResult,
  type EmailCompleteResult,
} from "@/app/(app)/learn/sim/[id]/email-actions";
import "./email.css";

/**
 * EmailSimRunner — the "Inbox Tamer" full sim (PRD/09). Visual rule-builder →
 * compiled prompt reveal → deterministic sort (with a live-AI narration) →
 * rubric coach card + tweak loop → make-it-real → celebration + grill. Buckets
 * are computed by the pure engine (lib/emailsim); the DB write + the one AI
 * flourish are server actions.
 */

type Phase = "intro" | "inbox" | "rules" | "prompt" | "run" | "rubric" | "setup" | "done";

export function EmailSimRunner({
  sim,
  narrateAction = narrateSort,
  coachAction = coachInboxSort,
  completeAction = completeEmailSim,
}: {
  sim: EmailSim;
  narrateAction?: (input: unknown) => Promise<SortNarrationResult>;
  coachAction?: (input: unknown) => Promise<InboxCoachResult>;
  completeAction?: (input: unknown) => Promise<EmailCompleteResult>;
}) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("intro");
  const [rules, setRules] = useState<EmailRule[]>(sim.starterRules);
  const [pendingCond, setPendingCond] = useState<string | null>(null);
  const [selfAdded, setSelfAdded] = useState(false);
  const [showBeat, setShowBeat] = useState(false);

  const [narration, setNarration] = useState<string | null>(null);
  const [narrating, setNarrating] = useState(false);

  const [coach, setCoach] = useState<InboxCoachResult | null>(null);
  const [coaching, setCoaching] = useState(false);

  const [grillPicked, setGrillPicked] = useState<number | null>(null);
  const [result, setResult] = useState<EmailCompleteResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const sorted = useMemo(() => classifyInbox(sim, rules), [sim, rules]);
  const grouped = useMemo(() => groupByBucket(sim, sorted), [sim, sorted]);
  const rubric = useMemo(() => gradeRulebook(sim, rules), [sim, rules]);
  const compiled = useMemo(() => compilePrompt(sim, rules), [sim, rules]);

  const usedConditionIds = new Set(rules.map((r) => r.conditionId));
  const availableConditions = sim.conditions.filter((c) => !usedConditionIds.has(c.id));
  const bucketByKey = (k: EmailBucket) => sim.buckets.find((b) => b.key === k)!;

  function addRule(bucketKey: EmailBucket) {
    if (!pendingCond) return;
    setRules((r) => [...r, { conditionId: pendingCond, bucketKey }]);
    setPendingCond(null);
    if (!selfAdded) {
      setSelfAdded(true);
      setShowBeat(true); // decision-beat after the first self-added rule
    }
  }
  function removeRule(conditionId: string) {
    setRules((r) => r.filter((x) => x.conditionId !== conditionId));
  }

  async function runSort() {
    setPhase("run");
    setNarrating(true);
    setNarration(null);
    void loadCoach(); // fire the coach in parallel so it's ready by the rubric card
    const r = await narrateAction(rules);
    setNarration(r.text);
    setNarrating(false);
  }

  async function loadCoach() {
    setCoaching(true);
    const c = await coachAction(rules);
    setCoach(c);
    setCoaching(false);
  }

  const reasonByEmailId = new Map((coach?.topReasons ?? []).map((t) => [t.emailId, t.reason]));

  async function finish() {
    setSaving(true);
    const r = await completeAction(rules);
    setResult(r);
    setSaving(false);
    setPhase("done");
  }

  function copyPrompt() {
    try {
      navigator.clipboard?.writeText(compiled);
    } catch {
      /* clipboard unavailable — still confirm optimistically */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  const copyLabel = copied ? "✓ Copied!" : "📋 Copy my prompt";

  const grillCorrect = Math.max(0, sim.grillBeat.branches.findIndex((b) => b.correct));
  const grillSolved = grillPicked === grillCorrect;

  // ---- chrome -------------------------------------------------------------
  const Header = ({ onBack, label }: { onBack: () => void; label: string }) => (
    <header className="es-top">
      <button className="es-icon" onClick={onBack} aria-label="Back">
        ←
      </button>
      <span className="es-top-title">{label}</span>
      <span className="es-icon es-ghost" aria-hidden />
    </header>
  );

  // Home gets its own space at the bottom, below the primary action.
  const homeLink = (
    <button className="es-home" onClick={() => router.push("/learn")}>
      🏠 Home
    </button>
  );

  // ==========================================================================
  if (phase === "intro") {
    return (
      <div className="es">
        <Header onBack={() => router.push(simBackHref())} label="Inbox Tamer" />
        <main className="es-center">
          <div className="es-hero" aria-hidden>
            📧
          </div>
          <h1 className="es-h1">Build your inbox sorter</h1>
          <p className="es-copy">{sim.intro.copy}</p>
          <button className="es-cta" onClick={() => setPhase("inbox")}>
            {sim.intro.cta}
          </button>
        </main>
      </div>
    );
  }

  // ==========================================================================
  if (phase === "inbox") {
    return (
      <div className="es">
        <Header onBack={() => setPhase("intro")} label="The messy inbox" />
        <main className="es-body">
          <p className="es-copy">{sim.inboxIntro}</p>
          <div className="es-stack">
            {sim.inbox.map((e) => (
              <div key={e.id} className="es-mail">
                <span className="es-mail-from">{e.from}</span>
                <span className="es-mail-sub">{e.subject}</span>
              </div>
            ))}
          </div>
          <div className="es-buckets-key">
            {sim.buckets.map((b) => (
              <span key={b.key} className="es-bkey">
                {b.emoji} <b>{b.label}</b> · {b.blurb}
              </span>
            ))}
          </div>
        </main>
        <footer className="es-foot">
          <button className="es-cta" onClick={() => setPhase("rules")}>
            Set the rules →
          </button>
          {homeLink}
        </footer>
      </div>
    );
  }

  // ==========================================================================
  if (phase === "rules") {
    return (
      <div className="es">
        <Header onBack={() => setPhase("inbox")} label="Build your rules" />
        <main className="es-body">
          <p className="es-kicker">Your rulebook</p>
          <div className="es-rulebook">
            {rules.length === 0 && <p className="es-muted">No rules yet, add your first below.</p>}
            {rules.map((r) => {
              const c = sim.conditions.find((x) => x.id === r.conditionId);
              const b = bucketByKey(r.bucketKey);
              const starter = sim.starterRules.some((s) => s.conditionId === r.conditionId);
              return (
                <div key={r.conditionId} className="es-rule">
                  <span className="es-rule-txt">
                    <b>IF</b> {c?.label} <b>→</b> {b.emoji} {b.label}
                  </span>
                  {starter && <span className="es-tag">suggested</span>}
                  <button
                    className="es-rule-x"
                    onClick={() => removeRule(r.conditionId)}
                    aria-label="Remove rule"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          {showBeat && (
            <div className="es-beat">
              <span aria-hidden>🔥</span> {sim.decisionBeat}
              <button className="es-beat-x" onClick={() => setShowBeat(false)}>
                Got it
              </button>
            </div>
          )}

          <p className="es-kicker">Add a rule</p>
          {pendingCond ? (
            <div className="es-pick">
              <p className="es-muted">
                Send <b>{sim.conditions.find((c) => c.id === pendingCond)?.label}</b> to…
              </p>
              <div className="es-bucket-btns">
                {sim.buckets.map((b) => (
                  <button key={b.key} className="es-bucket-btn" onClick={() => addRule(b.key)}>
                    {b.emoji} {b.label}
                  </button>
                ))}
              </div>
              <button className="es-link" onClick={() => setPendingCond(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="es-chips">
              {availableConditions.map((c) => (
                <button key={c.id} className="es-chip" onClick={() => setPendingCond(c.id)}>
                  + {c.label}
                </button>
              ))}
              {availableConditions.length === 0 && (
                <p className="es-muted">Every condition has a rule. Nice and thorough.</p>
              )}
            </div>
          )}
        </main>
        <footer className="es-foot">
          <button className="es-cta" disabled={rules.length < 3} onClick={() => setPhase("prompt")}>
            {rules.length < 3 ? `Add ${3 - rules.length} more rule${3 - rules.length > 1 ? "s" : ""}` : "See my prompt →"}
          </button>
          {homeLink}
        </footer>
      </div>
    );
  }

  // ==========================================================================
  if (phase === "prompt") {
    return (
      <div className="es">
        <Header onBack={() => setPhase("rules")} label="Your prompt" />
        <main className="es-body">
          <p className="es-copy">{sim.compiledPromptCopy}</p>
          <pre className="es-prompt">{compiled}</pre>
        </main>
        <footer className="es-foot">
          <button className="es-cta" onClick={runSort}>
            Run it →
          </button>
          {homeLink}
        </footer>
      </div>
    );
  }

  // ==========================================================================
  if (phase === "run") {
    return (
      <div className="es">
        <Header onBack={() => setPhase("prompt")} label={narrating ? "Sorting…" : "Sorted"} />
        <main className="es-body">
          {narrating ? (
            <div className="es-center">
              <RuneLoader size={160} />
              <p className="es-muted">Rune is reading your inbox…</p>
            </div>
          ) : (
            <>
              {narration && <div className="es-narration">{narration}</div>}
              <div className="es-columns">
                {sim.buckets.map((b) => (
                  <div key={b.key} className={`es-col ${b.key}`}>
                    <span className="es-col-h">
                      {b.emoji} {b.label}
                    </span>
                    {grouped[b.key].map((s) => {
                      const aiReason = reasonByEmailId.get(s.email.id);
                      return (
                        <div key={s.email.id} className="es-card">
                          <span className="es-card-sub">{s.email.subject}</span>
                          <span className="es-card-reason">
                            {s.matched ? s.reason : "no rule, flagged"}
                          </span>
                          {aiReason && <span className="es-card-airead">✨ {aiReason}</span>}
                        </div>
                      );
                    })}
                    {grouped[b.key].length === 0 && <span className="es-empty">-</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
        {!narrating && (
          <footer className="es-foot">
            <button className="es-cta" onClick={() => setPhase("rubric")}>
              How did I do? →
            </button>
            {homeLink}
          </footer>
        )}
      </div>
    );
  }

  // ==========================================================================
  if (phase === "rubric") {
    return (
      <div className="es">
        <Header onBack={() => setPhase("run")} label="Coach card" />
        <main className="es-body">
          {/* The card flips in real 3D from the sorted view (Design §Flow B). */}
          <div className="es-flip">
            <div className="es-flip-inner">
              <div className="es-score">
                <b>{rubric.score}</b>
                <small>/ {rubric.total} good habits</small>
              </div>
              <div className="es-checks">
                {rubric.results.map((r) => (
                  <div key={r.id} className={`es-check ${r.passed ? "pass" : "fail"}`}>
                    <span>{r.passed ? "✅" : "⬜"}</span>
                    {r.label}
                  </div>
                ))}
              </div>
              <div className={`es-improve${rubric.allClear ? " clear" : ""}`}>
                <b>{rubric.allClear ? "Nice work. " : "One improvement: "}</b>
                {coaching && !coach ? rubric.improvement : coach ? coach.coachNote : rubric.improvement}
              </div>
              {coach?.source === "fallback" && <SampleTag onRetry={loadCoach} />}
            </div>
          </div>
          <p className="es-muted es-tweak">{sim.tweakCopy}</p>
        </main>
        <footer className="es-foot es-foot-row">
          <button className="es-cta ghost" onClick={() => setPhase("rules")}>
            Tweak a rule
          </button>
          <button className="es-cta" onClick={() => setPhase("setup")}>
            Make it real →
          </button>
        </footer>
      </div>
    );
  }

  // ==========================================================================
  if (phase === "setup") {
    return (
      <div className="es">
        <Header onBack={() => setPhase("rubric")} label="Make it real" />
        <main className="es-body">
          <p className="es-copy">{sim.setup.copy}</p>
          <div className="es-safety">{sim.setup.safety}</div>
          <button className={`es-copy-btn${copied ? " done" : ""}`} onClick={copyPrompt}>
            {copyLabel}
          </button>
          {sim.setup.paths.map((p) => (
            <div key={p.key} className="es-path">
              <span className="es-path-h">
                Path {p.key} · {p.title}
              </span>
              <ol className="es-path-steps">
                {p.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              {p.note && <p className="es-path-note">{p.note}</p>}
            </div>
          ))}
        </main>
        <footer className="es-foot">
          <button className="es-cta" disabled={saving} onClick={finish}>
            {saving ? "Saving…" : "Finish & celebrate →"}
          </button>
          {homeLink}
        </footer>
      </div>
    );
  }

  // ========================================================================== done
  return (
    <div className="es">
      <main className="es-body">
        <section className="es-done">
        <div className="rune-cel">
          <RuneMascot state="celebrate" spriteSrc="/mascot/rune-hero-clean.png" dimensions={168} />
        </div>
        <h1 className="es-h1">Inbox Tamer! 🎉</h1>
        <p className="es-copy">{sim.celebration.copy}</p>

        {result && result.ok ? (
          result.alreadyDone ? (
            <p className="es-muted">Already completed. Your rulebook is saved in your second brain.</p>
          ) : (
            <div className="es-rewards">
              <span className="es-reward xp">+{result.xpAwarded} XP</span>
              <span className="es-reward badge">🏆 {result.badge}</span>
              {result.leveledUp && <span className="es-reward lvl">Tier {result.newLevel}!</span>}
              {result.streakAdvanced && (
                <span className="es-reward streak">🔥 {result.streak}-day streak</span>
              )}
            </div>
          )
        ) : (
          <p className="es-muted">{result ? "Saved. (Sync will retry.)" : "Saving…"}</p>
        )}

        <div className="es-grill">
          <p className="es-kicker">🔥 One more thing</p>
          <h2 className="es-grill-q">{sim.grillBeat.prompt}</h2>
          <div className="es-grill-opts">
            {sim.grillBeat.branches.map((br, i) => (
              <button
                key={i}
                className={`es-grill-opt ${
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
              </button>
            ))}
          </div>
          {grillPicked !== null && (
            <div className={`es-retort${grillSolved ? "" : " bad"}`}>
              {!grillSolved && <b>Not quite. </b>}
              {sim.grillBeat.branches[grillPicked].retort}
            </div>
          )}
        </div>

        </section>
      </main>
      <footer className="es-foot es-foot-row">
        <button className="es-cta ghost" onClick={copyPrompt}>
          {copyLabel}
        </button>
        <button className="es-cta" onClick={() => router.push("/learn")}>
          Done →
        </button>
      </footer>
    </div>
  );
}
