"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveProfileDetails } from "@/app/(app)/profile/actions";
import { editStore, type LeaveTarget } from "@/lib/profile/editStore";
import { seniorityLabel, professionLabel, proficiencyLabel } from "@/lib/profile/labels";
import {
  trackProfessionInterest,
  trackProfileEditSaved,
  trackLockedLevelTapped,
} from "@/app/actions/telemetry";
import {
  SENIORITY_OPTIONS,
  PROFESSION_OPTIONS,
  AI_LEVEL_OPTIONS,
  LEVEL_PREVIEWS,
  type LockedLevel,
} from "@/lib/onboarding";
import { LessonPath, L1_PREVIEW_PATH } from "@/components/brand/LessonPath";
import "./profile.css";

export type Details = {
  name: string | null;
  email: string | null;
  mobile: string | null;
  seniority: string | null;
  profession: string | null;
  ai_proficiency: string | null;
};

/** Small pencil to signal an inline-editable field (Name / Mobile look like
 *  plain text otherwise). SVG (not emoji) for crispness + no encoding issues. */
function EditPencil() {
  return (
    <svg
      className="ed-edit" viewBox="0 0 24 24" width="14" height="14" aria-hidden focusable="false"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/**
 * Editable "Your details" (grilled design, Session 14): inline inputs for
 * Name/Mobile, a bottom-sheet for Org role, full-screen overlays reusing the
 * onboarding card grids for Profession / AI proficiency. A single "Save Changes"
 * bar appears only when dirty; leaving Profile with unsaved changes is guarded
 * by a popup (Agree = discard & leave / Save Changes = save & leave).
 */
export function EditableDetails({ initial }: { initial: Details }) {
  const router = useRouter();
  const [base, setBase] = useState<Details>(initial); // last-saved baseline
  const [draft, setDraft] = useState<Details>(initial); // working copy
  const [sheet, setSheet] = useState<"role" | null>(null);
  const [overlay, setOverlay] = useState<"profession" | "level" | null>(null);
  // Tapping a locked L2/L3 opens its "coming soon" preview (proficiency stays L1).
  const [levelPreview, setLevelPreview] = useState<LockedLevel | null>(null);
  const [pendingLeave, setPendingLeave] = useState<LeaveTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null); // "X is coming soon"
  // Portal target only exists on the client; gate so SSR/first paint match.
  const [mounted, setMounted] = useState(false);
  // Portal needs document.body, which is client-only; flip a mount flag so SSR
  // and first client paint agree (no hydration mismatch).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const dirty =
    draft.name !== base.name ||
    draft.mobile !== base.mobile ||
    draft.seniority !== base.seniority ||
    draft.profession !== base.profession ||
    draft.ai_proficiency !== base.ai_proficiency;

  // Publish dirty state so TabBar / Sign out can consult it.
  useEffect(() => {
    editStore.setDirty(dirty);
  }, [dirty]);

  // Register the popup opener; clear on unmount so a stale handler can't fire.
  useEffect(() => {
    editStore.onLeaveRequest((t) => setPendingLeave(t));
    return () => {
      editStore.onLeaveRequest(null);
      editStore.setDirty(false);
    };
  }, []);

  // Native guard for refresh / tab-close while dirty.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // Auto-dismiss transient messages.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // Lock the page behind while a picker/sheet/modal is open, so scrolling stays
  // inside the sub-screen (was bubbling through and scrolling the profile page).
  useEffect(() => {
    const open =
      overlay !== null || sheet !== null || pendingLeave !== null || levelPreview !== null;
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [overlay, sheet, pendingLeave, levelPreview]);

  function diff() {
    const d: Record<string, unknown> = {};
    if (draft.name !== base.name) d.name = (draft.name ?? "").trim();
    if (draft.mobile !== base.mobile) d.mobile = (draft.mobile ?? "").trim();
    if (draft.seniority !== base.seniority && draft.seniority) d.seniority = draft.seniority;
    if (draft.profession !== base.profession && draft.profession) d.profession = draft.profession;
    if (draft.ai_proficiency !== base.ai_proficiency && draft.ai_proficiency)
      d.ai_proficiency = draft.ai_proficiency;
    return d;
  }

  async function doSave(): Promise<boolean> {
    setSaving(true);
    const d = diff();
    const res = await saveProfileDetails(d);
    setSaving(false);
    if (!res.ok) {
      setToast(res.error ?? "Could not save");
      return false;
    }
    setBase(draft);
    setToast("Changes saved ✓");
    // Metric #9b — seniority counts only on a committed change to a new value.
    if ("seniority" in d) void trackProfileEditSaved("seniority");
    return true;
  }

  async function performLeave(t: LeaveTarget) {
    editStore.setDirty(false);
    if (t.type === "signout") {
      await createClient().auth.signOut();
      window.location.assign("/login");
    } else {
      router.push(t.href);
    }
  }

  async function popupAgree() {
    const t = pendingLeave;
    setPendingLeave(null);
    if (t) await performLeave(t);
  }
  async function popupSaveAndLeave() {
    const t = pendingLeave;
    setPendingLeave(null);
    if (await doSave()) {
      if (t) await performLeave(t);
    } else if (t) {
      setPendingLeave(t); // save failed — keep the guard up
    }
  }

  const val = (s: string | null | undefined) => s || "-";

  return (
    <>
      <dl className="pf-details ed-list">
        <div className="ed-row">
          <dt>Name</dt>
          <dd className="ed-edit-wrap">
            <input
              className="ed-input"
              value={draft.name ?? ""}
              maxLength={60}
              placeholder="Your name"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <EditPencil />
          </dd>
        </div>
        <div className="ed-row">
          <dt>Email</dt>
          <dd className="ed-static">{val(base.email)}</dd>
        </div>
        <div className="ed-row">
          <dt>Mobile</dt>
          <dd className="ed-edit-wrap">
            <input
              className="ed-input"
              type="tel"
              value={draft.mobile ?? ""}
              maxLength={20}
              placeholder="Add mobile"
              onChange={(e) => setDraft({ ...draft, mobile: e.target.value })}
            />
            <EditPencil />
          </dd>
        </div>
        <button type="button" className="ed-row ed-pick" onClick={() => setSheet("role")}>
          <dt>Organization role</dt>
          <dd className="ed-pick-v">
            {val(seniorityLabel(draft.seniority))} <span aria-hidden>›</span>
          </dd>
        </button>
        <button type="button" className="ed-row ed-pick" onClick={() => setOverlay("profession")}>
          <dt>Profession</dt>
          <dd className="ed-pick-v">
            {val(professionLabel(draft.profession))} <span aria-hidden>›</span>
          </dd>
        </button>
        <button type="button" className="ed-row ed-pick" onClick={() => setOverlay("level")}>
          <dt>AI proficiency</dt>
          <dd className="ed-pick-v">
            {val(proficiencyLabel(draft.ai_proficiency))} <span aria-hidden>›</span>
          </dd>
        </button>
      </dl>

      {/* Floating layers are PORTALED to <body> so they escape the profile's
          nested stacking contexts (.pf-content z-index:1 sits under .pf-top
          z-index:2 — a nested z-index:60 can't cross that). At body level, fixed
          + z-index:60 covers the whole app frame. */}
      {mounted &&
        createPortal(
          <>
      {/* Org-role bottom sheet */}
      {sheet === "role" && (
        <div className="ed-scrim" onClick={() => setSheet(null)}>
          <div className="ed-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="ed-sheet-h">Organization role</h3>
            {SENIORITY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`ed-opt${draft.seniority === o.value ? " sel" : ""}`}
                onClick={() => {
                  setDraft({ ...draft, seniority: o.value });
                  setSheet(null);
                }}
              >
                <b>{o.label}</b>
                <small>{o.sub}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Profession overlay (reuses onboarding .prof cards) */}
      {overlay === "profession" && (
        <div className="ed-overlay">
          <header className="ed-ov-top">
            <button className="ed-ov-back" onClick={() => setOverlay(null)} aria-label="Back">
              ←
            </button>
            <span>Profession</span>
            <span className="ed-ov-spacer" />
          </header>
          <div className="ed-ov-body">
            <p className="hint">HR is ready now. Others are coming, tap to register interest.</p>
            <div className="prof-grid">
              {PROFESSION_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`prof${draft.profession === p.value ? " sel" : ""}${p.locked ? " lock" : ""}`}
                  onClick={() => {
                    if (p.locked) {
                      void trackProfessionInterest(p.value, "profile"); // metric #9a
                      setNotice(`${p.label} is coming soon. We'll notify you.`);
                    } else {
                      setDraft({ ...draft, profession: p.value });
                      setNotice(null);
                    }
                  }}
                >
                  <div className="pe">{p.emoji}</div>
                  <div className="pn2">{p.label}</div>
                  {p.locked ? <span className="soon">Notify me</span> : <div className="pd">Ready now</div>}
                </button>
              ))}
            </div>
            {notice && <p className="fldnote">{notice}</p>}
          </div>
          <footer className="ed-ov-foot">
            <button className="ob-btn teal" onClick={() => { setOverlay(null); setNotice(null); }}>
              Done
            </button>
          </footer>
        </div>
      )}

      {/* AI proficiency overlay (reuses onboarding .s cards) */}
      {overlay === "level" && (
        <div className="ed-overlay">
          <header className="ed-ov-top">
            <button className="ed-ov-back" onClick={() => setOverlay(null)} aria-label="Back">
              ←
            </button>
            <span>AI proficiency</span>
            <span className="ed-ov-spacer" />
          </header>
          <div className="ed-ov-body">
            <p className="hint">Level 1 is your path today. Levels 2 and 3 unlock after Level 1.</p>
            <div className="seg ed-levels">
              {AI_LEVEL_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`s${draft.ai_proficiency === o.value ? " sel" : ""}${o.locked ? " lock" : ""}`}
                  onClick={() => {
                    if (o.locked) {
                      // Show the locked "coming soon" preview; proficiency stays L1.
                      void trackLockedLevelTapped(o.value as LockedLevel, "profile"); // metric #8
                      setLevelPreview(o.value as LockedLevel);
                      setNotice(null);
                    } else {
                      setDraft({ ...draft, ai_proficiency: o.value });
                      setNotice(null);
                    }
                  }}
                >
                  {o.locked ? `${o.emoji} ${o.label}` : o.label}
                  <small>{o.locked ? "🔒 Coming soon" : o.sub}</small>
                </button>
              ))}
            </div>
            {notice && <p className="fldnote">{notice}</p>}
          </div>
          <footer className="ed-ov-foot">
            <button className="ob-btn teal" onClick={() => { setOverlay(null); setNotice(null); }}>
              Done
            </button>
          </footer>
        </div>
      )}

      {/* Locked L2/L3 preview (reuses the onboarding "coming soon" screen).
          Selecting L2/L3 does NOT change proficiency (stays L1) — this just
          shows what unlocks later. */}
      {levelPreview && (
        <div className="ed-overlay">
          <header className="ed-ov-top">
            <button className="ed-ov-back" onClick={() => setLevelPreview(null)} aria-label="Back">
              ←
            </button>
            <span>{LEVEL_PREVIEWS[levelPreview].badge}</span>
            <span className="ed-ov-spacer" />
          </header>
          <div className="ed-ov-body">
            <p className="cs-promise">{LEVEL_PREVIEWS[levelPreview].tagline}</p>
            <div className="cs-preview">
              <span className="cs-badge-float">🔒 {LEVEL_PREVIEWS[levelPreview].badge}</span>
              <LessonPath data={L1_PREVIEW_PATH} greyed />
            </div>
            <ul className="cs-units">
              {LEVEL_PREVIEWS[levelPreview].units.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
            <p className="cs-capstone">{LEVEL_PREVIEWS[levelPreview].capstone}</p>
          </div>
          <footer className="ed-ov-foot">
            <button className="ob-btn teal" onClick={() => setLevelPreview(null)}>
              Got it, unlocks after Level 1
            </button>
          </footer>
        </div>
      )}

      {/* Single Save bar — only when there are unsaved changes */}
      {dirty && (
        <div className="ed-savebar">
          <button className="ed-save" onClick={doSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}

      {/* Unsaved-changes leave guard */}
      {pendingLeave && (
        <div className="ed-scrim ed-scrim-center">
          <div className="ed-modal" role="dialog" aria-modal="true">
            <h3 className="ed-modal-h">Unsaved changes</h3>
            <p className="ed-modal-p">
              You did not Save Changes. Going to any other screen will result in no changes.
            </p>
            <div className="ed-modal-actions">
              <button className="ed-modal-ghost" onClick={popupAgree} disabled={saving}>
                Agree
              </button>
              <button className="ed-modal-primary" onClick={popupSaveAndLeave} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="ed-toast">{toast}</div>}
          </>,
          document.body,
        )}
    </>
  );
}
