"use client";
import { useEffect } from "react";
import { trackSimOpened } from "@/app/actions/telemetry";

export function SimOpenTracker({ simId, via }: { simId: string; via: "path" | "xp" }) {
  useEffect(() => {
    const key = `sim_opened:${simId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode: fall through and fire */
    }
    void trackSimOpened(simId, via);
  }, [simId, via]);
  return null;
}
