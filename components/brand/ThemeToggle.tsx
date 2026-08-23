"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Light/dark toggle, pinned to the app-surface top-right corner. The actual
 * class is set pre-paint by the inline script in layout.tsx (no flash); this
 * just flips it and persists the choice. Dark tokens live in globals.css `.dark`.
 *
 * The runner headers (lesson/sim/rapid-fire) reserve right padding so their
 * home button sits clear-left of this corner toggle (no overlap). Hidden on the
 * immersive Reels feed, where it would collide with the video player's own
 * top-right controls (and the feed is always dark anyway).
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  if (pathname === "/reels" || pathname === "/dev-preview/reels") return null;

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* private mode — ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="theme-toggle"
      data-dark={dark}
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      <span className="tt-track">
        <span className="tt-ic sun" aria-hidden>
          ☀️
        </span>
        <span className="tt-ic moon" aria-hidden>
          🌙
        </span>
        <span className="tt-knob" aria-hidden />
      </span>
    </button>
  );
}
