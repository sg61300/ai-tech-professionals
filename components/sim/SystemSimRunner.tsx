"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SystemSim, SysNode } from "@/content/schema";
import {
  getSample,
  incomingLabel,
  checkComprehension,
  buildRequirementsText,
} from "@/lib/systemsim";
import {
  completeSystemSim,
  type SystemCompleteResult,
} from "@/app/(app)/learn/sim/[id]/system-actions";
import { RuneMascot } from "@/components/brand/RuneMascot";
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

export function SystemSimRunner({
  sim,
  completeAction = completeSystemSim,
}: {
  sim: SystemSim;
  completeAction?: (input: unknown) => Promise<SystemCompleteResult>;
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

  const sample = useMemo(() => getSample(sim, sampleId)!, [sim, sampleId]);
  const reqText = useMemo(() => buildRequirementsText(sample), [sample]);

  const checkSolved = checkPick !== null && checkComprehension(sample, checkPick);
  const grillCorrect = Math.max(0, sim.grillBeat.branches.findIndex((b) => b.correct));
  const grillSolved = grillPicked === grillCorrect;

  async function finish() {
    setSaving(true);
    const r = await completeAction({ sampleId });
    setResult(r);
    setSaving(false);
    setPhase("done");
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

  const Header = ({ onBack, label }: { onBack: () => void; label: string }) => (
    <header className="sx-top">
      <button className="sx-icon" onClick={onBack} aria-label="Back">
        ←
      </button>
      <span className="sx-top-title">{label}</span>
      <span className="sx-icon sx-ghost" aria-hidden />
    </header>
  );

  // Home gets its own space at the bottom, below the primary action.
  const homeLink = (
    <button className="sx-home" onClick={() => router.push("/learn")}>
      🏠 Home
    </button>
  );

  const NodeCard = () =>
    tapped ? (
      <div className="sx-nodecard" role="dialog" aria-label="Step detail">
        <div className="sx-nodecard-h">
          {tapped.hr && <span className="sx-hrbadge">👋 HR owns this</span>}
          <b>{tapped.label}</b>
        </div>
        <p>{tapped.hint}</p>
        {tapped.decisionBeat && <p className="sx-beat">🔥 {tapped.decisionBeat}</p>}
        <button className="sx-link" onClick={() => setTapped(null)}>
          Close
        </button>
      </div>
    ) : null;

  const Flow = ({ onNodeTap, highlightHr }: { onNodeTap: (n: SysNode) => void; highlightHr: boolean }) => (
    <div className="sx-flow">
      {sample.nodes.map((n, i) => {
        const branch = incomingLabel(sample, n.id);
        return (
          <div key={n.id} className="sx-flow-row">
            {i > 0 && (
              <span className="sx-arrow">
                {branch ? <span className="sx-branch">{branch}</span> : null}↓
              </span>
            )}
            <button
              className={`sx-node ${n.kind}${highlightHr && n.hr ? " glow" : ""}`}
              style={{ animationDelay: `${i * 90}ms` }}
              onClick={() => onNodeTap(n)}
            >
              <span className="sx-node-glyph" aria-hidden>
                {KIND_GLYPH[n.kind]}
              </span>
              <span className="sx-node-label">{n.label}</span>
              {highlightHr && n.hr && <span className="sx-node-tag">HR</span>}
            </button>
          </div>
        );
      })}
    </div>
  );

  // ==========================================================================
  if (phase === "intro") {
    return (
      <div className="sx">
        <Header onBack={() => router.push("/learn")} label="System X-Ray" />
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
                className={`sx-sample${s.id === sampleId ? " on" : ""}`}
                onClick={() => setSampleId(s.id)}
              >
                {s.label}
                {s.id === sampleId && <span className="sx-sample-tick">✓</span>}
              </button>
            ))}
          </div>
          <div className="sx-soon">
            📝 Describe it / 🖼️ Upload a screenshot: <b>coming soon</b>. For now we map the
            closest preset.
          </div>
        </main>
        <footer className="sx-foot">
          <button className="sx-cta" onClick={() => setPhase("map")}>
            Generate the map →
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
        <Header onBack={() => setPhase("input")} label={sample.label} />
        <main className="sx-body">
          <p className="sx-kicker">Tap any step to understand it</p>
          <Flow onNodeTap={(n) => setTapped(n)} highlightHr />
          <NodeCard />
        </main>
        <footer className="sx-foot">
          <button className="sx-cta" onClick={() => { setTapped(null); setPhase("edges"); }}>
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
            onNodeTap={(n) => setCheckPick(n.id)}
            highlightHr={false}
          />
          {checkPick !== null && (
            <div className={`sx-checkres${checkSolved ? " good" : " bad"}`}>
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
          <h2 className="sx-q">{sim.grillBeat.prompt}</h2>
          <div className="sx-grill-opts">
            {sim.grillBeat.branches.map((br, i) => (
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
              {sim.grillBeat.branches[grillPicked].retort}
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
