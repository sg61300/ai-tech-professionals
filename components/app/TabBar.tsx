"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { editStore } from "@/lib/profile/editStore";
import { trackArticlesOpened } from "@/app/actions/telemetry";

/**
 * Bottom tab navigation (ADR-012): Learn, Sims, Reels, Articles, Profile. Auto-hides
 * inside a lesson/sim (not rendered there). Reels carries a notification badge;
 * Profile is the user avatar. Reels/Articles are "coming soon" for MVP but the
 * tabs are present so the shell matches the mockup.
 */
export function TabBar({
  avatarKey,
  reelsNew = false,
}: {
  avatarKey?: string | null;
  /** Show the "New" badge on the Reels tab (unseen approved reels exist). */
  reelsNew?: boolean;
}) {
  const pathname = usePathname();
  const on = (p: string) => pathname === p || pathname.startsWith(p + "/");

  // Unsaved-changes guard: if Profile has pending edits, intercept the tab nav
  // and let EditableDetails show its "You did not Save Changes" popup instead.
  const guard = (href: string) => (e: React.MouseEvent) => {
    if (editStore.isDirty()) {
      e.preventDefault();
      editStore.requestLeave({ type: "nav", href });
    }
  };

  return (
    <nav className="tabs" aria-label="Primary">
      {/* Shared gradient used by every tab glyph's stroke (the app's teal→violet
          AI signature) so the icons read as coloured, not flat grey. */}
      <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
        <defs>
          {/* Soothing, distinct hue per tab (soft mid-tones that read in light + dark). */}
          <linearGradient id="gLearn" x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#10b981" />
            <stop offset="1" stopColor="#2dd4bf" />
          </linearGradient>
          <linearGradient id="gSims" x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#14b8a6" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="gReels" x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fb7185" />
            <stop offset="1" stopColor="#c084fc" />
          </linearGradient>
          <linearGradient id="gArticles" x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#38bdf8" />
            <stop offset="1" stopColor="#818cf8" />
          </linearGradient>
        </defs>
      </svg>
      <Link href="/learn" onClick={guard("/learn")} className={`tab${on("/learn") ? " active" : ""}`}>
        <span className="iw">
          {/* Graduation cap — "lessons / course". */}
          <svg viewBox="0 0 24 24" aria-hidden style={{ stroke: "url(#gLearn)" }}>
            <path d="M12 4L2.5 8.2 12 12.4l9.5-4.2z" />
            <path d="M6 10.3V15c0 1.3 2.7 2.6 6 2.6s6-1.3 6-2.6v-4.7" />
            <path d="M21.5 8.2v4.6" />
          </svg>
        </span>
        Learn
      </Link>

      <Link href="/sims" onClick={guard("/sims")} className={`tab${on("/sims") ? " active" : ""}`}>
        <span className="iw">
          {/* Erlenmeyer flask (practice lab); the liquid carries a teal→violet
              fill so the icon reads as a distinct emblem, not another XP bolt. */}
          <svg viewBox="0 0 24 24" aria-hidden style={{ stroke: "url(#gSims)" }}>
            <defs>
              <linearGradient id="simsLiquid" x1="5" y1="20" x2="19" y2="11" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#14b8a6" />
                <stop offset="1" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <path d="M9 3.5h6" />
            <path d="M10.5 3.5v5.5L5.2 18.2a1.6 1.6 0 0 0 1.4 2.4h10.8a1.6 1.6 0 0 0 1.4-2.4L13.5 9V3.5" />
            <path
              d="M7.6 14h8.8l1.8 3.2a1.6 1.6 0 0 1-1.4 2.4H7.2a1.6 1.6 0 0 1-1.4-2.4z"
              style={{ fill: "url(#simsLiquid)", stroke: "none" }}
            />
          </svg>
        </span>
        Sims
      </Link>

      <Link href="/reels" onClick={guard("/reels")} className={`tab${on("/reels") ? " active" : ""}`}>
        <span className="iw">
          {/* Vertical short-form (Shorts) frame + a colored play mark. */}
          <svg viewBox="0 0 24 24" aria-hidden style={{ stroke: "url(#gReels)" }}>
            <defs>
              <linearGradient id="reelsPlay" x1="9" y1="8" x2="16" y2="16" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#fb7185" />
                <stop offset="1" stopColor="#c084fc" />
              </linearGradient>
            </defs>
            <rect x="6.5" y="3" width="11" height="18" rx="3.4" />
            <path
              d="M10.7 8.9v6.2l5-3.1z"
              style={{ fill: "url(#reelsPlay)", stroke: "none" }}
            />
          </svg>
          {reelsNew && (
            <span className="nb nb-new" aria-label="New reels available">
              New
            </span>
          )}
        </span>
        Reels
      </Link>

      <Link
        href="/articles"
        onClick={(e) => {
          void trackArticlesOpened(); // metric #4 — demand signal (tap = intent, even if guarded)
          guard("/articles")(e);
        }}
        className={`tab${on("/articles") ? " active" : ""}`}
      >
        <span className="iw">
          {/* Newspaper — headline bar + a column/image block reads as "articles". */}
          <svg viewBox="0 0 24 24" aria-hidden style={{ stroke: "url(#gArticles)" }}>
            <rect x="3.5" y="4.5" width="14" height="15" rx="1.6" />
            <path d="M17.5 8.5H20a1 1 0 0 1 1 1V18a1.5 1.5 0 0 1-1.5 1.5" />
            <path d="M6.5 8.3h8" />
            <path d="M6.5 12h3.4v4H6.5z" />
            <path d="M11.6 12h2.9M11.6 14h2.9M11.6 16h2.9" />
          </svg>
        </span>
        Articles
      </Link>

      <Link href="/profile" onClick={guard("/profile")} className={`tab${on("/profile") ? " active" : ""}`}>
        <span className="iw">
          <span className="av">
            {avatarKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/avatars/${avatarKey}.png`} alt="" />
            ) : null}
          </span>
        </span>
        Profile
      </Link>
    </nav>
  );
}
