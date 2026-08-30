"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { simBackHref } from "@/lib/sim/backHref";
import type { BiasSim, BiasCandidate } from "@/content/schema";
import { auditPassed, fixApplied, orderByRanking, type BiasRankItem } from "@/lib/biassim";
import { guardInput, MAX_LEN } from "@/lib/inputguard";
import {
  screenCandidates,
  completeBiasSim,
  type ScreenResult,
  type BiasCompleteResult,
} from "@/app/(app)/learn/sim/[id]/bias-actions";
import { RuneLoader } from "@/components/brand/RuneLoader";
import { RuneMascot } from "@/components/brand/RuneMascot";
import { SampleTag } from "./SampleTag";
import "./bias.css";

/**
 * BiasSimRunner — "Bias Catcher" (spec §4.3), the L1 capstone. Seven beats around
 * a visible before/after ranking: hook -> the stack -> AI ranks (naive) -> audit
 * the biased reasons -> fix the prompt -> AI re-ranks (fairer) -> grill +
 * celebrate. The audit + fix checks are deterministic (lib/biassim); the two live
 * rankings have authored golden fallbacks (SampleTag). Actions are injectable for
 * the dev-preview harness + tests.
 */

type Phase = "intro" | "stack" | "round1" | "audit" | "fix" | "round2" | "done";

// Hoisted to module scope so re-renders don't remount them (which would reset the
// before/after animation + toggle state). Everything they need comes via props.
function Header({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <header className="bs-top">
      <button className="bs-icon" onClick={onBack} aria-label="Back">
        ←
      </button>
      <span className="bs-top-title">{label}</span>
      <span className="bs-icon bs-ghost" aria-hidden />
    </header>
  );
}

function RankList({
  ranking,
  showMoves,
  candById,
  r1RankById,
}: {
  ranking: BiasRankItem[];
  showMoves: boolean;
  candById: Map<string, BiasCandidate>;
  r1RankById: Map<string, number>;
}) {
  return (
    <div className="bs-ranklist">
      {orderByRanking(ranking).map((it) => {
        const c = candById.get(it.candidateId);
        const prev = r1RankById.get(it.candidateId);
        const moved = showMoves && prev !== undefined ? prev - it.rank : 0; // +ve = moved up
        const cls = moved > 0 ? "up" : moved < 0 ? "down" : "";
        return (
          <div key={it.candidateId} className={`bs-rankrow ${cls}`}>
            <span className="bs-rank-badge">{it.rank}</span>
            <span className="bs-rank-main">
              <span className="bs-rank-name">{c?.name ?? it.candidateId}</span>
              <span className="bs-rank-reason">{it.reason}</span>
            </span>
            {moved !== 0 && (
              <span className={`bs-move ${moved > 0 ? "up" : "down"}`}>
                {moved > 0 ? `▲ ${moved}` : `▼ ${-moved}`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BiasSimRunner({
  sim,
  screenAction = screenCandidates,
  completeAction = completeBiasSim,
}: {
  sim: BiasSim;
  screenAction?: (input: unknown) => Promise<ScreenResult>;
  completeAction?: () => Promise<BiasCompleteResult>;
}) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("intro");

  // Optional guarded job title (beat 2).
  const [titleText, setTitleText] = useState("");
  const [titleAttested, setTitleAttested] = useState(false);
  const [appliedTitle, setAppliedTitle] = useState<string | null>(null);

  // Two live rankings + their sources.
  const [r1, setR1] = useState<ScreenResult | null>(null);
  const [r2, setR2] = useState<ScreenResult | null>(null);
  const [screening, setScreening] = useState(false);

  const [auditPicks, setAuditPicks] = useState<Set<string>>(new Set());
  const [auditChecked, setAuditChecked] = useState(false);
  const [fixPicks, setFixPicks] = useState<Set<string>>(new Set());
  const [fixChecked, setFixChecked] = useState(false);

  const [grillPicked, setGrillPicked] = useState<number | null>(null);
  const [result, setResult] = useState<BiasCompleteResult | null>(null);
  const [saving, setSaving] = useState(false);

  const candById = useMemo(
    () => new Map(sim.candidates.map((c) => [c.id, c])),
    [sim.candidates],
  );

  const titleGuard = titleText.trim().length > 0 ? guardInput(titleText) : null;
  const titleError = titleGuard && !titleGuard.ok ? titleGuard.reason : null;
  const canApplyTitle = !!titleGuard?.ok && titleAttested;

  const auditOk = auditPassed(sim, [...auditPicks]);
  const fixOk = fixApplied(sim, [...fixPicks]);
  const grillCorrect = Math.max(0, sim.grillBeat.branches.findIndex((b) => b.correct));
  const grillSolved = grillPicked === grillCorrect;

  // round-1 rank per candidate, to show up/down movement in round 2.
  const r1RankById = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of r1?.ranking ?? []) m.set(it.candidateId, it.rank);
    return m;
  }, [r1]);

  async function runScreen(fixToggleIds: string[], set: (r: ScreenResult) => void) {
    setScreening(true);
    const r = await screenAction({
      fixToggleIds,
      jobTitle: appliedTitle ?? undefined,
    });
    set(r);
    setScreening(false);
  }

  function toStack() {
    setPhase("stack");
  }
  async function toRound1() {
    setPhase("round1");
    if (!r1) await runScreen([], setR1);
  }
  async function toRound2() {
    setPhase("round2");
    await runScreen([...fixPicks], setR2);
  }
  async function finish() {
    setSaving(true);
    const r = await completeAction();
    setResult(r);
    setSaving(false);
    setPhase("done");
  }

  function toggle(set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    set((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const homeLink = (
    <button className="bs-home" onClick={() => router.push("/learn")}>
      🏠 Home
    </button>
  );

  // ==========================================================================
  if (phase === "intro") {
    return (
      <div className="bs">
        <Header onBack={() => router.push(simBackHref())} label="Bias Catcher" />
        <main className="bs-center">
          <div className="bs-hero" aria-hidden>
            ⚖️
          </div>
          <h1 className="bs-h1">{"Can you trust AI's picks?"}</h1>
          <p className="bs-copy">{sim.intro.copy}</p>
          <button className="bs-cta" style={{ maxWidth: "22rem" }} onClick={toStack}>
            {sim.intro.cta} →
          </button>
        </main>
      </div>
    );
  }

  // ==========================================================================
  if (phase === "stack") {
    return (
      <div className="bs">
        <Header onBack={() => setPhase("intro")} label="The stack" />
        <main className="bs-body">
          <p className="bs-copy">{sim.hook}</p>
          <p className="bs-muted">{sim.stackCopy}</p>

          <details className="bs-titlebox">
            <summary>{sim.jobTitleInputCopy}</summary>
            <input
              className="bs-title-input"
              placeholder={`Default: ${sim.jobTitle}`}
              maxLength={MAX_LEN}
              value={titleText}
              onChange={(e) => {
                setTitleText(e.target.value);
                setAppliedTitle(null);
              }}
            />
            {titleError && <div className="bs-title-err">⚠️ {titleError}</div>}
            <label className="bs-attest">
              <input
                type="checkbox"
                checked={titleAttested}
                onChange={(e) => setTitleAttested(e.target.checked)}
              />
              <span>This is a generic job title, with no names or company details.</span>
            </label>
            <button
              className="bs-cta ghost"
              disabled={!canApplyTitle}
              onClick={() => titleGuard?.ok && setAppliedTitle(titleGuard.normalized)}
            >
              Use this title
            </button>
            {appliedTitle && <span className="bs-applied">✓ Ranking for: {appliedTitle}</span>}
          </details>

          <div className="bs-cands">
            {sim.candidates.map((c) => (
              <div key={c.id} className="bs-cand">
                <span className="bs-cand-h">
                  <span className="bs-cand-name">{c.name}</span>
                  <span className="bs-cand-role">{c.role}</span>
                </span>
                <span className="bs-cand-merit">{c.merit}</span>
                <span className="bs-cand-tags">
                  <span className={`bs-tag${c.eliteCollege ? " elite" : ""}`}>{c.college}</span>
                  {c.hasGap && <span className="bs-tag gap">{c.gapNote ?? "Employment gap"}</span>}
                </span>
              </div>
            ))}
          </div>
        </main>
        <footer className="bs-foot">
          <button className="bs-cta" onClick={toRound1}>
            Let AI rank them →
          </button>
          {homeLink}
        </footer>
      </div>
    );
  }

  // ==========================================================================
  if (phase === "round1") {
    return (
      <div className="bs">
        <Header onBack={() => setPhase("stack")} label={screening ? "Ranking…" : "Round 1: AI's ranking"} />
        <main className="bs-body">
          {screening || !r1 ? (
            <div className="bs-center" style={{ minHeight: "50dvh" }}>
              <RuneLoader size={150} />
              <p className="bs-muted">Rune is ranking the candidates…</p>
            </div>
          ) : (
            <>
              <p className="bs-copy">{sim.round1Copy}</p>
              {r1.source === "fallback" && <SampleTag onRetry={() => runScreen([], setR1)} />}
              <RankList ranking={r1.ranking} showMoves={false} candById={candById} r1RankById={r1RankById} />
            </>
          )}
        </main>
        {!screening && r1 && (
          <footer className="bs-foot">
            <button className="bs-cta" onClick={() => setPhase("audit")}>
              Check its reasons →
            </button>
            {homeLink}
          </footer>
        )}
      </div>
    );
  }

  // ==========================================================================
  if (phase === "audit") {
    return (
      <div className="bs">
        <Header onBack={() => setPhase("round1")} label="Audit the reasons" />
        <main className="bs-body">
          <h2 className="bs-q">{sim.auditCopy}</h2>
          <div className="bs-chips">
            {sim.auditReasons.map((r) => (
              <button
                key={r.id}
                className={`bs-chip${auditPicks.has(r.id) ? " on" : ""}`}
                aria-pressed={auditPicks.has(r.id)}
                onClick={() => {
                  setAuditChecked(false);
                  toggle(setAuditPicks, r.id);
                }}
              >
                {auditPicks.has(r.id) ? "✓ " : ""}
                {r.label}
              </button>
            ))}
          </div>
          {auditChecked && (
            <div className={`bs-feedback ${auditOk ? "good" : "bad"}`}>
              {auditOk ? (
                <>
                  <b>Exactly. </b>
                  {"College pedigree and an employment gap shouldn't decide a hire. Skills and track record should."}
                </>
              ) : (
                <>
                  <b>Not quite. </b>
                  {"Flag every reason that shouldn't matter, and only those. Think about what actually predicts doing the HR job well."}
                </>
              )}
            </div>
          )}
        </main>
        <footer className="bs-foot">
          {auditOk ? (
            <button className="bs-cta" onClick={() => setPhase("fix")}>
              Now fix the prompt →
            </button>
          ) : (
            <button className="bs-cta" onClick={() => setAuditChecked(true)}>
              Check my flags
            </button>
          )}
          {homeLink}
        </footer>
      </div>
    );
  }

  // ==========================================================================
  if (phase === "fix") {
    return (
      <div className="bs">
        <Header onBack={() => setPhase("audit")} label="Fix the prompt" />
        <main className="bs-body">
          <h2 className="bs-q">{sim.fixCopy}</h2>
          <div className="bs-chips">
            {sim.fixToggles.map((t) => (
              <button
                key={t.id}
                className={`bs-chip${fixPicks.has(t.id) ? " on" : ""}`}
                aria-pressed={fixPicks.has(t.id)}
                onClick={() => {
                  setFixChecked(false);
                  toggle(setFixPicks, t.id);
                }}
              >
                {fixPicks.has(t.id) ? "✓ " : ""}
                {t.label}
              </button>
            ))}
          </div>
          {fixChecked && !fixOk && (
            <div className="bs-feedback bad">
              <b>Almost. </b>Turn on the instructions that remove bias, and leave off anything that
              adds it back.
            </div>
          )}
        </main>
        <footer className="bs-foot">
          {fixOk ? (
            <button className="bs-cta" onClick={toRound2}>
              Re-rank with the fair prompt →
            </button>
          ) : (
            <button className="bs-cta" onClick={() => setFixChecked(true)}>
              Apply the fix
            </button>
          )}
          {homeLink}
        </footer>
      </div>
    );
  }

  // ==========================================================================
  if (phase === "round2") {
    return (
      <div className="bs">
        <Header onBack={() => setPhase("fix")} label={screening ? "Re-ranking…" : "Round 2: fairer ranking"} />
        <main className="bs-body">
          {screening || !r2 ? (
            <div className="bs-center" style={{ minHeight: "50dvh" }}>
              <RuneLoader size={150} />
              <p className="bs-muted">Rune is re-ranking with your fair prompt…</p>
            </div>
          ) : (
            <>
              <p className="bs-copy">{sim.round2Copy}</p>
              {r2.source === "fallback" && <SampleTag onRetry={() => runScreen([...fixPicks], setR2)} />}
              <RankList ranking={r2.ranking} showMoves candById={candById} r1RankById={r1RankById} />
            </>
          )}
        </main>
        {!screening && r2 && (
          <footer className="bs-foot">
            <button className="bs-cta" disabled={saving} onClick={finish}>
              {saving ? "Saving…" : "Finish & celebrate →"}
            </button>
            {homeLink}
          </footer>
        )}
      </div>
    );
  }

  // ========================================================================== done
  return (
    <div className="bs">
      <main className="bs-body">
        <section className="bs-done">
          <div className="rune-cel">
            <RuneMascot state="celebrate" spriteSrc="/mascot/rune-hero-clean.png" dimensions={168} />
          </div>
          <h1 className="bs-h1">Bias Catcher! 🎉</h1>
          <p className="bs-copy">{sim.celebration.copy}</p>

          {result && result.ok ? (
            result.alreadyDone ? (
              <p className="bs-muted">Already completed. Your fair rubric is saved in your second brain.</p>
            ) : (
              <div className="bs-rewards">
                <span className="bs-reward xp">+{result.xpAwarded} XP</span>
                <span className="bs-reward badge">🏆 {result.badge}</span>
                {result.leveledUp && <span className="bs-reward lvl">Tier {result.newLevel}!</span>}
                {result.streakAdvanced && (
                  <span className="bs-reward streak">🔥 {result.streak}-day streak</span>
                )}
              </div>
            )
          ) : (
            <p className="bs-muted">{result ? "Saved. (Sync will retry.)" : "Saving…"}</p>
          )}

          <div className="bs-grill">
            <p className="bs-kicker">🔥 One more thing</p>
            <h2 className="bs-q">{sim.grillBeat.prompt}</h2>
            <div className="bs-grill-opts">
              {sim.grillBeat.branches.map((br, i) => (
                <button
                  key={i}
                  className={`bs-grill-opt ${
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
              <div className={`bs-retort${grillSolved ? "" : " bad"}`}>
                {!grillSolved && <b>Not quite. </b>}
                {sim.grillBeat.branches[grillPicked].retort}
              </div>
            )}
          </div>
        </section>
      </main>
      <footer className="bs-foot">
        <button className="bs-cta" onClick={() => router.push("/learn")}>
          Done →
        </button>
      </footer>
    </div>
  );
}
