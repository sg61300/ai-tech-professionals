"use client";

import { useEffect } from "react";
import { recordSession } from "@/app/actions/session";

/**
 * Fires the session-level funnel events once per browser session (guarded by
 * sessionStorage so a multi-page session counts once). Mounted app-wide in the
 * root layout; recordSession() itself no-ops for signed-out users, so this is
 * safe on public pages too.
 */
export function SessionTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("session_tracked")) return;
      sessionStorage.setItem("session_tracked", "1");
    } catch {
      /* private mode — fall through and fire once for this mount */
    }
    // Resolved theme at load — $set as preferred_theme so users who never toggle
    // are still counted (metric #10). The pre-paint script in layout.tsx has
    // already applied the .dark class by the time this effect runs.
    const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    void recordSession(theme);
  }, []);

  return null;
}
