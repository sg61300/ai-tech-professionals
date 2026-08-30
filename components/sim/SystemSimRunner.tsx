"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { simBackHref } from "@/lib/sim/backHref";
import type { SystemSim, SysNode, SysSample } from "@/content/schema";
import {
  getSample,
  incomingLabel,
  checkComprehension,
  buildRequirementsText,
  buildSystemGrill,
} from "@/lib/systemsim";
import { guardInput, MAX_LEN } from "@/lib/inputguard";
import {
  completeSystemSim,
  generateXray,
  type SystemCompleteResult,
  type XrayGenResult,
} from "@/app/(app)/learn/sim/[id]/system-actions";
import { RuneLoader } from "@/components/brand/RuneLoader";
import { RuneMascot } from "@/components/brand/RuneMascot";
import { SampleTag } from "./SampleTag";
import "./system.css";

/**
 * SystemSimRunner — "System X-Ray" (PRD/10). Intro → pick a system → animated,
 * tappable data-flow map (HR steps glow) → edge cases → light comprehension tap
 * → requirements starter → celebration + grill. Rendered from a typed graph
 * (lib/systemsim); the DB write is a server action. MVP uses preset samples;
 * live text/image generation is a documented later seam.
 */

type Phase = "intro" | "input" | "map" | "edges" | "check" | "reqs" | "done";

const KIND_GLYPH: Record<string, string> = {
  start: "▶",
  step: "▪",
  decision: "◆",
  hr: "👋",
  it: "💻",
  end: "⏹",
};

// Hoisted to module scope so a re-render (e.g. tapping a node) does NOT remount
// the whole map — which would reset the tap feedback, the selected-node highlight,
// and replay every node's entry animation (the flicker FIX 2/3 are meant to avoid).
function Header({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <header className="sx-top">
      <button className="sx-icon" onClick={onBack} aria-label="Back">
        ←
      </button>
      <span className="sx-top-title">{label}</span>
      <span className="sx-icon sx-ghost" aria-hidden />
    </header>
  );
}

function NodeCard({
  node,
  cardRef,
  onClose,
}: {
  node: SysNode | null;
  cardRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  if (!node) return null;
  return (
    // key + ref (FIX 2): remounts per tap so the slide/fade replays, and lets us
    // scroll the panel into view (it renders below a long, scrollable node list).
    <div key={node.id} ref={cardRef} className="sx-nodecard" role="dialog" aria-label="Step detail">
      <div className="sx-nodecard-h">
        {node.hr && <span className="sx-hrbadge">👋 HR owns this</span>}
        <b>{node.label}</b>
      </div>
      <p>{node.hint}</p>
      {node.decisionBeat && <p className="sx-beat">🔥 {node.decisionBeat}</p>}
      <button className="sx-link" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

function Flow({
  sample,
  onNodeTap,
  highlightHr,
  selectedId,
  feedback,
}: {
  sample: SysSample;
  onNodeTap: (n: SysNode) => void;
  highlightHr: boolean;
  /** FIX 2: the tapped node on the map gets a distinct selected state. */
  selectedId?: string | null;
  /** FIX 3: the comprehension answer turns correct (green + ✓) or incorrect (red). */
  feedback?: { id: string; ok: boolean } | null;
}) {
  return (
    <div className="sx-flow">
      {sample.nodes.map((n, i) => {
        const branch = incomingLabel(sample, n.id);
        const isSelected = selectedId === n.id;
        const fb = feedback && feedback.id === n.id ? (feedback.ok ? " correct" : " incorrect") : "";
        return (
          <div key={n.id} className="sx-flow-row">
            {i > 0 && (
              <span className="sx-arrow">
                {branch ? <span className="sx-branch">{branch}</span> : null}↓
              </span>
            )}
            <button
              className={`sx-node ${n.kind}${highlightHr && n.hr ? " glow" : ""}${isSelected ? " sel" : ""}${fb}`}
              aria-pressed={isSelected || (feedback?.id === n.id ? true : undefined)}
              style={{ animationDelay: `${i * 90}ms` }}
              onClick={() => onNodeTap(n)}
            >
              <span className="sx-node-glyph" aria-hidden>
                {feedback && feedback.id === n.id && feedback.ok ? "✓" : KIND_GLYPH[n.kind]}
              </span>
              <span className="sx-node-label">{n.label}</span>
              {highlightHr && n.hr && <span className="sx-node-tag">HR</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function SystemSimRunner({
  sim,
  completeAction = completeSystemSim,
  generateAction = generateXray,
}: {
  sim: SystemSim;
  completeAction?: (input: unknown) => Promise<SystemCompleteResult>;
  generateAction?: (input: unknown) => Promise<XrayGenResult>;
}) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("intro");
  const [sampleId, setSampleId] = useState(sim.samples[0].id);
  const [tapped, setTapped] = useState<SysNode | null>(null);
  const [checkPick, setCheckPick] = useState<string | null>(null);
  const [grillPicked, setGrillPicked] = useState<number | null>(null);
  const [result, setResult] = useState<SystemCompleteResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Scroll targets (FIX 2/3): the tapped-node hint panel and the comprehension result.
  const nodeCardRef = useRef<HTMLDivElement | null>(null);
  const checkResRef = useRef<HTMLDivElement | null>(null);

  // Describe-your-own (spec §4.2b): guarded free-text seam → one AI graph call.
  const [describeMode, setDescribeMode] = useState(false);
  const [workflowText, setWorkflowText] = useState("");
  const [attested, setAttested] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<SysSample | null>(null);
  const [genSource, setGenSource] = useState<"live" | "fallback" | null>(null);

  // Client-side guard (UX only; the server re-validates and is authoritative).
  const guard = describeMode ? guardInput(workflowText) : null;
  const guardError = describeMode && workflowText.trim().length > 0 && guard && !guard.ok ? guard.reason : null;
  const canGenerate = describeMode
    ? !!guard?.ok && attested && !generating
    : true;

  // The active graph: a generated one wins over the selected preset.
  const sample = useMemo(
    () => generated ?? getSample(sim, sampleId)!,
    [generated, sim, sampleId],
  );
  const reqText = useMemo(() => buildRequirementsText(sample), [sample]);

  const checkSolved = checkPick !== null && checkComprehension(sample, checkPick);
  // FIX 4: grill derived from THIS system's own edge cases (not the static onboarding one).
  const grill = useMemo(() => buildSystemGrill(sample), [sample]);
  const grillCorrect = Math.max(0, grill.branches.findIndex((b) => b.correct));
  const grillSolved = grillPicked === grillCorrect;

  // FIX 2: when a node is tapped on the map, bring its hint panel into view.
  useEffect(() => {
    if (phase === "map" && tapped && nodeCardRef.current) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      nodeCardRef.current.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    }
  }, [tapped, phase]);

  // FIX 3: when the comprehension answer is tapped, bring the feedback into view.
  useEffect(() => {
    if (phase === "check" && checkPick !== null && checkResRef.current) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      checkResRef.current.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    }
  }, [checkPick, phase]);

  async function finish() {
    setSaving(true);
    const r = await completeAction(generated ? { generated } : { sampleId });
    setResult(r);
    setSaving(false);
    setPhase("done");
  }

  /** Deterministic path (preset) renders instantly; the AI path shows an inline loader. */
  async function proceedToMap() {
    if (!describeMode) {
      setGenerated(null);
      setGenSource(null);
      setPhase("map");
      return;
    }
    if (!guard?.ok) return; // guarded: never fire on invalid input
    setGenerating(true);
    setPhase("map");
    const r = await generateAction({ workflowType: guard.normalized });
    setGenerated(r.sample);
    setGenSource(r.source);
    setGenerating(false);
  }

  /** Retry the generation (SampleTag) without leaving the map. */
  async function retryGenerate() {
    if (!guard?.ok) return;
    setGenerating(true);
    const r = await generateAction({ workflowType: guard.normalized });
    setGenerated(r.sample);
    setGenSource(r.source);
    setGenerating(false);
  }
  function copyReq() {
    try {
      navigator.clipboard?.writeText(reqText);
    } catch {
      /* clipboard unavailable — still confirm optimistically */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  const copyLabel = copied ? "✓ Copied!" : "📋 Copy requirements";

  // Home gets its own space at the bottom, below the primary action.
  const homeLink = (
    <button className="sx-home" onClick={() => router.push("/learn")}>
      🏠 Home
    </button>
  );

  // ==========================================================================
  if (phase === "intro") {
    return (
      <div className="sx">
        <Header onBack={() => router.push(simBackHref())} label="System X-Ray" />
        <main className="sx-center">
          <div className="sx-hero" aria-hidden>
            🩻
          </div>
          <h1 className="sx-h1">X-ray any HR system</h1>
          <p className="sx-copy">{sim.intro.copy}</p>
          <button className="sx-cta" onClick={() => setPhase("input")}>
            {sim.intro.cta}
          </button>
        </main>
      </div>
    );
  }

  // ==========================================================================
  if (phase === "input") {
    return (
      <div className="sx">
        <Header onBack={() => setPhase("intro")} label="Choose a system" />
        <main className="sx-body">
          <p className="sx-copy">{sim.inputCopy}</p>
          <div className="sx-safety">{sim.safety}</div>
          <p className="sx-kicker">⭐ Sample systems</p>
          <div className="sx-samples">
            {sim.samples.map((s) => (
              <button
                key={s.id}
                className={`sx-sample${!describeMode && s.id === sampleId ? " on" : ""}`}
                aria-pressed={!describeMode && s.id === sampleId}
                onClick={() => {
                  setDescribeMode(false);
                  setSampleId(s.id);
                }}
              >
                {s.label}
                {!describeMode && s.id === sampleId && <span className="sx-sample-tick">✓</span>}
              </button>
            ))}
            <button
              className={`sx-sample${describeMode ? " on" : ""}`}
              aria-pressed={describeMode}
              onClick={() => setDescribeMode(true)}
            >
              📝 Describe your own
              {describeMode && <span className="sx-sample-tick">✓</span>}
            </button>
          </div>

          {describeMode && (
            <div className="sx-describe">
              <label className="sx-describe-label" htmlFor="sx-workflow">
                What kind of HR workflow? (a type, not real records)
              </label>
              <textarea
                id="sx-workflow"
                className="sx-describe-input"
                placeholder="e.g. employee offboarding, appraisal cycle, reimbursement approval"
                maxLength={MAX_LEN}
                rows={2}
                value={workflowText}
                onChange={(e) => setWorkflowText(e.target.value)}
              />
              <div className="sx-describe-meta">
                <span>{workflowText.length} / {MAX_LEN}</span>
              </div>
              {guardError && <div className="sx-describe-err">⚠️ {guardError}</div>}
              <label className="sx-attest">
                <input
                  type="checkbox"
                  checked={attested}
                  onChange={(e) => setAttested(e.target.checked)}
                />
                <span>
                  This is a generic example, with no real personal or confidential data. We block
                  obvious identifiers and never store your text.
                </span>
              </label>
            </div>
          )}
        </main>
        <footer className="sx-foot">
          <button className="sx-cta" disabled={!canGenerate} onClick={proceedToMap}>
            {describeMode ? "Generate my map →" : "Generate the map →"}
          </button>
          {homeLink}
        </footer>
      </div>
    );
  }

  // ==========================================================================
  if (phase === "map") {
    return (
      <div className="sx">
        <Header onBack={() => setPhase("input")} label={generating ? "Mapping…" : sample.label} />
        <main className="sx-body">
          {generating ? (
            <div className="sx-center" style={{ minHeight: "50dvh" }}>
              <RuneLoader size={150} />
              <p className="sx-muted">Rune is tuning your map…</p>
            </div>
          ) : (
            <>
              {genSource === "fallback" && (
                <div className="sx-airow">
                  <SampleTag onRetry={retryGenerate} />
                  <span className="sx-muted">Mapped the closest sample system for now.</span>
                </div>
              )}
              <p className="sx-kicker">Tap any step to understand it</p>
              <Flow sample={sample} onNodeTap={(n) => setTapped(n)} highlightHr selectedId={tapped?.id} />
              <NodeCard node={tapped} cardRef={nodeCardRef} onClose={() => setTapped(null)} />
            </>
          )}
        </main>
        <footer className="sx-foot">
          <button
            className="sx-cta"
            disabled={generating}
            onClick={() => { setTapped(null); setPhase("edges"); }}
          >
            Where are the trapdoors? →
          </button>
          {homeLink}
        </footer>
      </div>
    );
  }

  // ==========================================================================
  if (phase === "edges") {
    return (
      <div className="sx">
        <Header onBack={() => setPhase("map")} label="Edge cases & risks" />
        <main className="sx-body">
          <p className="sx-copy">{sim.edgeCasesCopy}</p>
          <div className="sx-risks">
            {sample.edgeCases.map((e, i) => (
              <div key={i} className="sx-risk">
                <span className="sx-risk-h">⚠️ {e.risk}</span>
                <span className="sx-risk-why">{e.why}</span>
              </div>
            ))}
          </div>
        </main>
        <footer className="sx-foot">
          <button className="sx-cta" onClick={() => setPhase("check")}>
            Quick check →
          </button>
          {homeLink}
        </footer>
      </div>
    );
  }

  // ==========================================================================
  if (phase === "check") {
    return (
      <div className="sx">
        <Header onBack={() => setPhase("edges")} label="Quick check" />
        <main className="sx-body">
          <h2 className="sx-q">{sample.comprehension.prompt}</h2>
          <Flow
            sample={sample}
            onNodeTap={(n) => setCheckPick(n.id)}
            highlightHr={false}
            feedback={checkPick !== null ? { id: checkPick, ok: checkSolved } : null}
          />
          {checkPick !== null && (
            <div ref={checkResRef} className={`sx-checkres${checkSolved ? " good" : " bad"}`}>
              <b>{checkSolved ? "Exactly. " : "Not that one. "}</b>
              {checkSolved ? sample.comprehension.insight : sample.comprehension.hint}
            </div>
          )}
        </main>
        <footer className="sx-foot">
          <button className="sx-cta" disabled={!checkSolved} onClick={() => setPhase("reqs")}>
            {checkSolved ? "Turn it into requirements →" : "Tap the right step to continue"}
          </button>
          {homeLink}
        </footer>
      </div>
    );
  }

  // ==========================================================================
  if (phase === "reqs") {
    return (
      <div className="sx">
        <Header onBack={() => setPhase("check")} label="Requirements starter" />
        <main className="sx-body">
          <p className="sx-copy">{sim.requirementsCopy}</p>
          <div className="sx-reqbox">
            <b>{sample.label}, must-haves (draft):</b>
            <ul>
              {sample.requirements.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="sx-banner">{sim.requirementsBanner}</div>
          <button className={`sx-copy-btn${copied ? " done" : ""}`} onClick={copyReq}>
            {copyLabel}
          </button>
        </main>
        <footer className="sx-foot">
          <button className="sx-cta" disabled={saving} onClick={finish}>
            {saving ? "Saving…" : "Finish & celebrate →"}
          </button>
          {homeLink}
        </footer>
      </div>
    );
  }

  // ========================================================================== done
  return (
    <div className="sx">
      <main className="sx-body">
        <section className="sx-done">
        <div className="rune-cel">
          <RuneMascot state="celebrate" spriteSrc="/mascot/rune-hero-clean.png" dimensions={168} />
        </div>
        <h1 className="sx-h1">System X-Ray! 🎉</h1>
        <p className="sx-copy">{sim.celebration.copy}</p>

        {result && result.ok ? (
          result.alreadyDone ? (
            <p className="sx-muted">Already completed. Your X-ray is saved in your second brain.</p>
          ) : (
            <div className="sx-rewards">
              <span className="sx-reward xp">+{result.xpAwarded} XP</span>
              <span className="sx-reward badge">🏆 {result.badge}</span>
              {result.leveledUp && <span className="sx-reward lvl">Tier {result.newLevel}!</span>}
              {result.streakAdvanced && (
                <span className="sx-reward streak">🔥 {result.streak}-day streak</span>
              )}
            </div>
          )
        ) : (
          <p className="sx-muted">{result ? "Saved. (Sync will retry.)" : "Saving…"}</p>
        )}

        <div className="sx-grill">
          <p className="sx-kicker">🔥 One more thing</p>
          <h2 className="sx-q">{grill.prompt}</h2>
          <div className="sx-grill-opts">
            {grill.branches.map((br, i) => (
              <button
                key={i}
                className={`sx-grill-opt ${
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
            <div className={`sx-retort${grillSolved ? "" : " bad"}`}>
              {!grillSolved && <b>Not quite. </b>}
              {grill.branches[grillPicked].retort}
            </div>
          )}
        </div>

        </section>
      </main>
      <footer className="sx-foot sx-foot-row">
        <button className="sx-cta ghost" onClick={copyReq}>
          {copyLabel}
        </button>
        <button className="sx-cta" onClick={() => router.push("/learn")}>
          Done →
        </button>
      </footer>
    </div>
  );
}
