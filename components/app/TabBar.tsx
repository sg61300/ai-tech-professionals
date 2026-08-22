"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Bottom tab navigation (ADR-012): Learn, Reels, Articles, Profile. Auto-hides
 * inside a lesson/sim (not rendered there). Reels carries a notification badge;
 * Profile is the user avatar. Reels/Articles are "coming soon" for MVP but the
 * tabs are present so the shell matches the mockup.
 */
export function TabBar({ avatarKey }: { avatarKey?: string | null }) {
  const pathname = usePathname();
  const on = (p: string) => pathname === p || pathname.startsWith(p + "/");

  return (
    <nav className="tabs" aria-label="Primary">
      <Link href="/learn" className={`tab${on("/learn") ? " active" : ""}`}>
        <span className="iw">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z" />
            <path d="M18 3v18" />
          </svg>
        </span>
        Learn
      </Link>

      <Link href="/reels" className={`tab${on("/reels") ? " active" : ""}`}>
        <span className="iw">
          <svg viewBox="0 0 24 24" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="M10 9l5 3-5 3z" />
          </svg>
          <span className="nb">3</span>
        </span>
        Reels
      </Link>

      <Link href="/articles" className={`tab${on("/articles") ? " active" : ""}`}>
        <span className="iw">
          <svg viewBox="0 0 24 24" aria-hidden>
            <rect x="3" y="5" width="15" height="14" rx="2" />
            <path d="M18 8h3v9a2 2 0 0 1-2 2" />
            <path d="M7 9h7M7 13h7M7 17h4" />
          </svg>
        </span>
        Articles
      </Link>

      <Link href="/profile" className={`tab${on("/profile") ? " active" : ""}`}>
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
