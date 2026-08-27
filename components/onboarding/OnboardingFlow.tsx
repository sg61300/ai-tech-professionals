"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AI_LEVEL_OPTIONS,
  AVATARS,
  INTRO_CARDS,
  LEVEL_PREVIEWS,
  PROFESSION_OPTIONS,
  SENIORITY_OPTIONS,
  type LockedLevel,
  type OnboardingStep,
} from "@/lib/onboarding";
import { saveOnboarding } from "@/app/onboarding/actions";
import { trackLockedLevelTapped, trackProfessionInterest } from "@/app/actions/telemetry";
import { RuneLoader } from "@/components/brand/RuneLoader";
import { LessonPath, L1_PREVIEW_PATH } from "@/components/brand/LessonPath";
import { ReferralApplyModal } from "@/components/referral/ReferralApplyModal";

type Initial = {
  name: string;
  avatarName: string;
  mobile: string;
  avatarKey: string | null;
  seniority: string | null;
  aiComfort: string | null;
};

/** Small Rune coach bubble shown atop each step. */
function Coach({ children }: { children: React.ReactNode }) {
  return (
    <div className="ob-coach">
      <div className="r">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascot/rune-hero-clean.png" alt="Rune" />
      </div>
      <div className="b">{children}</div>
    </div>
  );
}

function Dots({ index }: { index: number }) {
  return (
    <div className="ob-dots">
      {[0, 1, 2].map((i) => (
        <i key={i} className={i === index ? "on" : undefined} />
      ))}
    </div>
  );
}

export function OnboardingFlow({
  startStep,
  initial,
  saveAction = saveOnboarding,
  alreadyReferred = false,
}: {
  startStep: OnboardingStep;
  initial: Initial;
  /** Injectable so the local visual-preview harness (and tests) can stub persistence. */
  saveAction?: typeof saveOnboarding;
  /** True when this user was already attributed via an invite link — skip the code prompt. */
  alreadyReferred?: boolean;
}) {
  // "coming-soon" is a transient sub-view of the level step, not a persisted step.
  const [step, setStep] = useState<OnboardingStep | "coming-soon">(startStep);
  const [name, setName] = useState(initial.name);
  const [avatarName, setAvatarName] = useState(initial.avatarName);
  const [mobile, setMobile] = useState(initial.mobile);
  const [avatarKey, setAvatarKey] = useState<string>(initial.avatarKey ?? AVATARS[0].key);
  const [seniority, setSeniority] = useState<string | null>(initial.seniority);
  const [aiLevel, setAiLevel] = useState<string | null>(initial.aiComfort);
  const [comingSoon, setComingSoon] = useState<LockedLevel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // First-signup referral prompt: shown over the "building" beat once onboarding
  // completes, unless the user was already attributed via an invite link.
  const [showReferral, setShowReferral] = useState(false);

  // Timezone captured once, client-side, to persist with the final step.
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {
      /* keep default */
    }
  }, []);

  // Progressive-focus phase for the merged level screen (1=role, 2=comfort, 3=done).
  const levelPhase = useMemo(() => {
    if (seniority && aiLevel) return 3;
    if (seniority) return 2;
    return 1;
  }, [seniority, aiLevel]);

  async function persist(patch: Parameters<typeof saveOnboarding>[0]): Promise<boolean> {
    setBusy(true);
    setError(null);
    const res = await saveAction(patch);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    return true;
  }

  // ---- Step handlers -------------------------------------------------------
  async function fromProfession() {
    if (await persist({ profession: "hr" })) setStep("profile");
  }

  async function fromProfile() {
    if (!name.trim()) return;
    const ok = await persist({
      name: name.trim(),
      avatar_key: avatarKey as never,
      avatar_name: avatarName.trim() ? avatarName.trim() : null,
      mobile: mobile.trim() ? mobile.trim() : null,
    });
    if (ok) setStep("level");
  }

  // Finish onboarding: mark it complete and enter the app. Called AFTER the
  // referral modal is done (or immediately when the user was already referred).
  //
  // Why onboarding_complete is set HERE and not with the level fields: persisting
  // onboarding_complete flips firstUnfinishedStep() to null, so the next render of
  // the /onboarding server page redirect()s to /learn. saveOnboarding is a
  // mutating server action (it revalidatePath("/learn")), so completing it makes
  // Next auto-refresh THIS route — /onboarding re-renders and redirect()s to /learn
  // on its own. That single server-driven navigation is what carries us into the
  // app. We must NOT also window.location.assign("/learn") here: that second,
  // redundant navigation raced the redirect and showed the RuneLoader twice (the
  // "loader appears twice" bug). Setting the flag only at finish also keeps the
  // redirect from unmounting the referral modal before it can show.
  async function finishOnboarding() {
    // Reveal the "Cooking up your path…" loader immediately so the screen shows
    // progress while the completion save + server redirect run.
    setShowReferral(false);
    setStep("building");
    // On success the server action's revalidate → /onboarding redirect → /learn
    // navigates us in; no manual nav. On failure, surface the error (back to the
    // level step) instead of stranding the user on the building loader.
    if (!(await persist({ onboarding_complete: true }))) setStep("level");
  }

  // Reach the "building" beat: level saved but onboarding NOT yet complete, so the
  // page won't redirect. Then show the referral prompt (first signup) unless the
  // user already came in via an invite link, in which case just finish.
  async function afterLevelBeat() {
    const minBeat = new Promise((r) => setTimeout(r, 1500));
    await minBeat;
    if (alreadyReferred) {
      await finishOnboarding();
    } else {
      setShowReferral(true);
    }
  }

  async function fromLevel() {
    if (levelPhase < 3 || !seniority || aiLevel !== "l1") return;
    setStep("building");
    // Persist level data only (NOT onboarding_complete — see finishOnboarding).
    const ok = await persist({
      seniority: seniority as never,
      ai_proficiency: "l1",
      timezone,
    });
    if (ok) {
      await afterLevelBeat();
    } else {
      setStep("level"); // save failed, let them retry
    }
  }

  // Skip on the final step: complete with sensible defaults (keep any role level
  // already tapped, else Entry) + Level 1, then go straight to Learn. No dead ends.
  async function skipLevel() {
    setStep("building");
    const ok = await persist({
      seniority: (seniority ?? "entry") as never,
      ai_proficiency: "l1",
      timezone,
    });
    if (ok) {
      await afterLevelBeat();
    } else {
      setStep("level");
    }
  }

  // ---- Screens -------------------------------------------------------------
  if (step === "intro") {
    return (
      <main className="ob-screen">
        <div className="ob-nav">
          <button className="ob-back" disabled aria-hidden />
          <span style={{ flex: 1 }} />
          <span className="ob-navspacer" />
        </div>
        <Coach>
          Hi, I&apos;m <b>Rune</b>! Here&apos;s how you&apos;ll go from curious to capable.
        </Coach>
        <h2>How it works</h2>
        <p className="hint">Three swipes and you&apos;re off.</p>
        <div className="ob-intro-cards">
          {INTRO_CARDS.map((c) => (
            <div className="ob-intro-card" key={c.emoji}>
              <span className="em">{c.emoji}</span>
              <span className="cx" dangerouslySetInnerHTML={{ __html: mdBold(c.md) }} />
            </div>
          ))}
        </div>
        <div className="ob-cta">
          <button className="ob-btn teal" onClick={() => setStep("profession")}>
            Let&apos;s go →
          </button>
        </div>
      </main>
    );
  }

  if (step === "profession") {
    return (
      <main className="ob-screen">
        {busy && (
          <div className="ob-busy" aria-live="polite">
            <RuneLoader size={132} />
          </div>
        )}
        <div className="ob-nav">
          <button className="ob-back" onClick={() => setStep("intro")}>
            ←
          </button>
          <Dots index={0} />
          <span className="ob-navspacer" />
        </div>
        <Coach>
          What do you do? I&apos;ll tailor every example to your <b>world</b>.
        </Coach>
        <h2>Pick your field</h2>
        <p className="hint">HR is ready now. Others are coming, tap to get first dibs.</p>
        <div className="prof-grid">
          {PROFESSION_OPTIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`prof${p.value === "hr" ? " sel" : ""}${p.locked ? " lock" : ""}`}
              onClick={() => {
                if (p.locked) {
                  void trackProfessionInterest(p.value, "onboarding"); // metric #9a
                  setError(`We're starting with HR and rolling out fast, ${p.label} is coming soon.`);
                }
              }}
            >
              <div className="pe">{p.emoji}</div>
              <div className="pn2">{p.label}</div>
              {p.locked ? <span className="soon">Notify me</span> : <div className="pd">Ready now</div>}
            </button>
          ))}
        </div>
        {error && <p className="fldnote" style={{ color: "var(--muted-foreground)" }}>{error}</p>}
        <div className="ob-cta">
          <button className="ob-btn teal" onClick={fromProfession} disabled={busy}>
            {busy ? "Saving…" : "Continue →"}
          </button>
        </div>
      </main>
    );
  }

  if (step === "profile") {
    return (
      <main className="ob-screen">
        {busy && (
          <div className="ob-busy" aria-live="polite">
            <RuneLoader size={132} />
          </div>
        )}
        <div className="ob-nav">
          <button className="ob-back" onClick={() => setStep("profession")}>
            ←
          </button>
          <Dots index={1} />
          <span className="ob-navspacer" />
        </div>
        <Coach>
          Pick a face for your journey, this shows on your <b>Profile</b> tab.
        </Coach>
        <h2>Choose your avatar</h2>
        <p className="hint">Free, licensed set. You can change it any time.</p>
        <div className="av-grid">
          {AVATARS.map((a) => (
            <button
              key={a.key}
              type="button"
              className={`avatar${a.key === avatarKey ? " sel" : ""}`}
              style={{ background: a.gradient }}
              aria-label={a.key}
              onClick={() => setAvatarKey(a.key)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/avatars/${a.key}.png`} alt={a.key} />
            </button>
          ))}
        </div>
        <div className="ob-fields">
          <input
            className="fld"
            type="text"
            placeholder="Your name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="fld"
            type="text"
            placeholder="Awesome avatar name · optional"
            value={avatarName}
            maxLength={30}
            onChange={(e) => setAvatarName(e.target.value)}
          />
          <input
            className="fld"
            type="tel"
            placeholder="Mobile · optional"
            value={mobile}
            maxLength={20}
            onChange={(e) => setMobile(e.target.value)}
          />
          <p className="fldnote">
            We greet you by your avatar name if set, otherwise your real name.
          </p>
        </div>
        {error && <p className="fldnote">{error}</p>}
        <div className="ob-cta">
          <button
            className={`ob-btn teal${!name.trim() ? " locked" : ""}`}
            onClick={fromProfile}
            disabled={busy || !name.trim()}
          >
            {busy ? "Saving…" : "Continue →"}
          </button>
        </div>
      </main>
    );
  }

  if (step === "level") {
    // Row emphasis (progressive focus) without hiding options: role is the focus
    // until chosen; then the AI-level row takes focus. Locked L2/L3 always stay
    // visible and tappable.
    const roleCls = `frow${!seniority ? " active" : ""}`;
    const comfortCls = `frow${!seniority ? " dim" : aiLevel === "l1" ? "" : " active"}`;
    return (
      <main className={`ob-screen${levelPhase < 3 ? " focusing" : ""}`}>
        <div className="spotlight" />
        <div className="ob-nav">
          <button className="ob-back" onClick={() => setStep("profile")}>
            ←
          </button>
          <Dots index={2} />
          <span className="ob-navspacer" />
        </div>
        <Coach>
          Last one! This sets your <b>starting path</b>, no wrong answers.
        </Coach>
        <h2>Where are you today?</h2>
        <p className="hint">Two quick taps and we&apos;ll drop you at the right lesson.</p>

        <div className={roleCls}>
          <div className="seg-label">Your role level</div>
          <div className="seg">
            {SENIORITY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`s${seniority === o.value ? " sel" : ""}`}
                onClick={() => setSeniority(o.value)}
              >
                {o.label}
                <small>{o.sub}</small>
              </button>
            ))}
          </div>
        </div>

        <div className={comfortCls}>
          <div className="seg-label">Your AI level</div>
          <div className="seg">
            {AI_LEVEL_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`s${aiLevel === o.value ? " sel" : ""}${o.locked ? " lock" : ""}`}
                onClick={() => {
                  if (!seniority) return; // pick a role level first
                  if (o.locked) {
                    void trackLockedLevelTapped(o.value as LockedLevel, "onboarding"); // metric #8
                    setComingSoon(o.value as LockedLevel);
                    setStep("coming-soon");
                  } else {
                    setAiLevel(o.value);
                  }
                }}
              >
                {o.locked ? `${o.emoji} ${o.label}` : o.label}
                <small>{o.locked ? "🔒 Coming soon" : o.sub}</small>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="fldnote">{error}</p>}
        <div className="ob-cta">
          <button
            className={`ob-btn coral${levelPhase < 3 ? " locked" : ""}`}
            onClick={fromLevel}
            disabled={busy || levelPhase < 3}
          >
            Start Lesson 1 →
          </button>
          <button className="ob-skiplink" onClick={skipLevel} disabled={busy}>
            Skip for now
          </button>
        </div>
      </main>
    );
  }

  if (step === "coming-soon" && comingSoon) {
    const preview = LEVEL_PREVIEWS[comingSoon];
    return (
      <main className="ob-screen">
        <div className="ob-nav">
          <button
            className="ob-back"
            onClick={() => {
              setComingSoon(null);
              setStep("level");
            }}
          >
            ←
          </button>
          <span style={{ flex: 1 }} />
          <span className="ob-navspacer" />
        </div>
        <Coach>
          Peek ahead! <b>{preview.badge}</b>, you&apos;ll unlock it after Level 1.
        </Coach>
        <h2>Your AI Partner is Coming Soon</h2>
        <p className="cs-promise">{preview.tagline}</p>

        <div className="cs-preview">
          <span className="cs-badge-float">🔒 {preview.badge}</span>
          <LessonPath data={L1_PREVIEW_PATH} greyed />
        </div>

        <ul className="cs-units">
          {preview.units.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
        <p className="cs-capstone">{preview.capstone}</p>

        <div className="ob-cta">
          <button
            className="ob-btn teal"
            onClick={() => {
              setComingSoon(null);
              setAiLevel("l1");
              setStep("level");
            }}
          >
            ← Start at Level 1
          </button>
        </div>
      </main>
    );
  }

  // building (+ first-signup referral prompt over it once complete)
  return (
    <main className="ob-screen">
      <div className="ob-building">
        <RuneLoader size={160} />
        <h2 style={{ marginTop: 8 }}>Cooking up your path… 🍳</h2>
        <p className="hint">Assembling your personalized Level 1 map.</p>
      </div>
      {showReferral && <ReferralApplyModal onDone={finishOnboarding} />}
    </main>
  );
}

/** Minimal **bold** -> <b> for the fixed, trusted intro strings only. */
function mdBold(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}
