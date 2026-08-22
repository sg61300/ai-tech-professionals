"use client";

import { useEffect, useState } from "react";

/**
 * Light/dark toggle. The actual class is set pre-paint by the inline script in
 * layout.tsx (no flash); this just flips it and persists the choice. Dark tokens
 * live in app/globals.css `.dark`.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

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
