"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { editStore } from "@/lib/profile/editStore";
import { trackArticlesOpened } from "@/app/actions/telemetry";

/**
 * Bottom tab navigation (ADR-012): Learn, Reels, Articles, Profile. Auto-hides
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
      <Link href="/learn" onClick={guard("/learn")} className={`tab${on("/learn") ? " active" : ""}`}>
        <span className="iw">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z" />
            <path d="M18 3v18" />
          </svg>
        </span>
        Learn
      </Link>

      <Link href="/reels" onClick={guard("/reels")} className={`tab${on("/reels") ? " active" : ""}`}>
        <span className="iw">
          <svg viewBox="0 0 24 24" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="M10 9l5 3-5 3z" />
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
          <svg viewBox="0 0 24 24" aria-hidden>
            <rect x="3" y="5" width="15" height="14" rx="2" />
            <path d="M18 8h3v9a2 2 0 0 1-2 2" />
            <path d="M7 9h7M7 13h7M7 17h4" />
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
