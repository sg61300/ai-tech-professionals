"use client";

import { useState } from "react";
import { applyReferralCode, recordReferralShare } from "@/app/actions/referral";

const SHARE_TEXT = "Learn to do your real job with AI. Come learn with me on Rune!";
const SUBJECT = "Come learn AI with me on Rune";

type Channel = "whatsapp" | "telegram" | "gmail" | "email" | "native" | "copy";

/* Brand + UI icons for the share row. Brand marks use their official colors so
   each channel is instantly recognizable; Email/More are neutral line icons. */
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden focusable="false">
      <path
        fill="#25D366"
        d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.042zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"
      />
    </svg>
  );
}
function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden focusable="false">
      <path
        fill="#229ED9"
        d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
      />
    </svg>
  );
}
function GmailIcon() {
  return (
    <svg viewBox="0 0 52 40" width="19" height="15" aria-hidden focusable="false">
      <path fill="#4285F4" d="M3.64 40h8.18V20.18L0 11v25.45C0 38.4 1.6 40 3.64 40z" />
      <path fill="#34A853" d="M40.18 40h8.18C50.4 40 52 38.4 52 36.45V11L40.18 20.18V40z" />
      <path fill="#FBBC04" d="M40.18 3.64v16.54L52 11V5.45C52 .4 46.23-2.48 42.18.56z" />
      <path fill="#EA4335" d="M11.82 20.18V3.64L26 14.27 40.18 3.64v16.54L26 30.82z" />
      <path fill="#C5221F" d="M0 5.45V11l11.82 9.18V3.64L9.82.56C5.77-2.48 0 .4 0 5.45z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden focusable="false" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="M3 6l9 6 9-6" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden focusable="false" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8l7.6-4.3M8.2 13.2l7.6 4.3" />
    </svg>
  );
}

/**
 * Referral share card (ADR-020). Shows the user's invite link with Copy +
 * WhatsApp / Telegram / Gmail / Email / native share. Each tap fires a
 * server-side `referral_link_shared {channel}` event. `link` is built
 * server-side (from request headers) so there's no browser-origin effect and no
 * hydration mismatch. The link points at the site root with `?ref=<code>`,
 * which the middleware captures as a first-touch cookie and attributes at the
 * invitee's signup.
 */
export function ReferralShareCard({ code, link }: { code: string; link: string }) {
  const [copied, setCopied] = useState(false);

  const track = (channel: Channel) => void recordReferralShare(channel);
  // Draft the share message in clear parts: a promo + the invite code (so the
  // friend knows what to do), kept separate from the app link on its own line.
  // `promo` (no link) is used where the channel carries the URL in its own field
  // (Telegram, native share); `msg` inlines the link for plain-text channels.
  const promo = `${SHARE_TEXT}\n\nUse my invite code ${code} when you sign up, and we both earn bonus XP once you finish your first simulation.`;
  const msg = `${promo}\n\nJoin here: ${link}`;
  const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  const share = async (channel: Channel) => {
    track(channel);
    switch (channel) {
      case "whatsapp":
        open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
        break;
      case "telegram":
        // Telegram renders `url` separately from `text`, so send the promo as
        // text and the link as the dedicated url field.
        open(
          `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(promo)}`,
        );
        break;
      case "gmail":
        open(
          `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(msg)}`,
        );
        break;
      case "email":
        window.location.assign(
          `mailto:?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(msg)}`,
        );
        break;
      case "native":
        // Use the OS share sheet where available; otherwise fall back to copy.
        if (navigator.share) {
          try {
            await navigator.share({ title: SUBJECT, text: promo, url: link });
          } catch {
            /* user dismissed the share sheet — no-op */
          }
        } else {
          await copyText(link);
        }
        break;
    }
  };

  // Copy an arbitrary value with a legacy fallback for tabs/permissions where the
  // async clipboard API is blocked. Returns whether the copy succeeded.
  const copyText = async (value: string): Promise<boolean> => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        ok = true;
      }
    } catch {
      /* async clipboard blocked (unfocused tab / permissions) — try legacy below */
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        /* give up silently */
      }
    }
    return ok;
  };

  // The box shows just the CODE (clean, easy to read out). Copy copies the code —
  // a friend types it into the signup prompt / Profile. The channel buttons send a
  // plain app link (no ?ref); the friend opens the app and enters the code, so
  // attribution is via the code, not the link (user decision, Session 23).
  const copyCode = async () => {
    track("copy");
    // Persist the copied state while the user stays on the profile screen —
    // leaving and returning re-mounts this and resets it to "Copy".
    if (await copyText(code)) setCopied(true);
  };

  return (
    <div className="rf-card">
      <p className="rf-lead">
        Share your code or link. When a friend finishes their taste simulation, you <b>both</b>{" "}
        bag bonus XP. Free XP for being nice.
      </p>

      <div className="rf-link">
        <span className="rf-link-v rf-code-v">{code}</span>
        <button type="button" className={copied ? "rf-copy copied" : "rf-copy"} onClick={copyCode}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      <div className="rf-channels">
        <button type="button" onClick={() => share("whatsapp")}>
          <WhatsAppIcon /> WhatsApp
        </button>
        <button type="button" onClick={() => share("telegram")}>
          <TelegramIcon /> Telegram
        </button>
        <button type="button" onClick={() => share("gmail")}>
          <GmailIcon /> Gmail
        </button>
        <button type="button" onClick={() => share("email")}>
          <MailIcon /> Email
        </button>
        <button type="button" onClick={() => share("native")}>
          <ShareIcon /> More
        </button>
      </div>
    </div>
  );
}

export const APPLY_ERRORS: Record<string, string> = {
  unknown_code: "We couldn't find that code. Double-check and try again.",
  self_referral: "That's your own code, share it with a friend instead.",
  already_referred: "You've already applied a referral code.",
  value_window_closed: "Referral codes can only be added before your first simulation.",
  not_signed_in: "Please sign in and try again.",
};

/**
 * "Have a referral code?" input (ADR-020 entry point 2). Only rendered when the
 * user is still eligible (no code applied yet, taste sim not done). Applies via
 * the server action, which enforces apply-once / no-self / value-window.
 */
export function ApplyReferralCard({ alreadyApplied = false }: { alreadyApplied?: boolean }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  // `alreadyApplied` reflects a persisted referred_by, so the confirmation stays
  // shown across reloads until the taste sim is done (the card is hidden after).
  const [done, setDone] = useState(alreadyApplied);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await applyReferralCode(code.trim(), "profile");
    setBusy(false);
    if (res.ok) {
      setDone(true);
    } else {
      setError(APPLY_ERRORS[res.reason] ?? "Something went wrong. Try again.");
    }
  };

  return (
    <div className="rf-apply-card">
      <div className="rf-apply-head">
        <span className="rf-apply-ic" aria-hidden>
          <TicketIcon />
        </span>
        <div className="rf-apply-copy">
          <h3 className="rf-apply-title">Have a referral code?</h3>
          <p className="rf-apply-sub">
            A friend sent you here? Drop their code in before your first simulation and you
            <b> both</b> score bonus XP.
          </p>
        </div>
      </div>

      {done ? (
        <div className="rf-applied">
          🎉 Code applied! Finish your taste simulation and the bonus lands for both of you.
        </div>
      ) : (
        <form className="rf-apply" onSubmit={submit}>
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Enter code"
            aria-label="Referral code"
            autoCapitalize="characters"
            className="rf-apply-in"
          />
          <button type="submit" className="rf-apply-btn" disabled={busy || !code.trim()}>
            {busy ? "…" : "Apply"}
          </button>
          {error && <p className="rf-apply-err">{error}</p>}
        </form>
      )}
    </div>
  );
}

function TicketIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden focusable="false"
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4 2 2 0 0 1 0-4Z" />
      <path d="M13 6v12" strokeDasharray="1.5 2.5" />
    </svg>
  );
}
