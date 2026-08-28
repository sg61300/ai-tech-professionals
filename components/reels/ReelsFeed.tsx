"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REEL_WATCH_MS } from "@/lib/reels";
import { parseYouTubePlayerState, YT_STATE_PLAYING } from "@/lib/reels/player";
import { trackReelsOpened, trackReelsScreenTime } from "@/app/actions/telemetry";
import "./reels.css";

export type Reel = {
  id: number;
  youtubeId: string;
  title: string;
  channel: string | null;
  topic: string | null;
};

type ToggleType = "like" | "save" | "share" | "report";
type ToggleFn = (
  reelId: number,
  type: ToggleType,
  reason?: string,
) => Promise<{ ok: boolean; active?: boolean; error?: string }>;

const REPORT_REASONS = [
  "Not relevant to HR / AI",
  "Inappropriate or offensive",
  "Misleading or spam",
  "Video won't play",
  "Other",
];
type WatchFn = (
  reelId: number,
) => Promise<{ ok: boolean; xpAwarded?: number; error?: string }>;

export type ReelsFeedProps = {
  reels: Reel[];
  initialLiked: number[];
  initialSaved: number[];
  watchedIds: number[];
  onToggle: ToggleFn;
  onWatch: WatchFn;
};

export function ReelsFeed({
  reels,
  initialLiked,
  initialSaved,
  watchedIds,
  onToggle,
  onWatch,
}: ReelsFeedProps) {
  const [active, setActive] = useState(0);
  // Index whose player has actually started PLAYING. Until the active reel's
  // player fires PLAYING we show its poster thumbnail (over which the iframe
  // then fades in) instead of a black frame — deriving `revealed` from this
  // avoids a reset-on-active-change setState-in-effect.
  const [revealedIdx, setRevealedIdx] = useState<number | null>(null);
  const activeRef = useRef(0);
  const [liked, setLiked] = useState<Set<number>>(new Set(initialLiked));
  const [saved, setSaved] = useState<Set<number>>(new Set(initialSaved));
  const [shared, setShared] = useState<Set<number>>(new Set());
  const [reported, setReported] = useState<Set<number>>(new Set());
  const [reportFor, setReportFor] = useState<Reel | null>(null);
  const [muted, setMuted] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const watched = useRef<Set<number>>(new Set(watchedIds));
  const mutedRef = useRef(true);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const activeFrameRef = useRef<HTMLIFrameElement | null>(null);
  const watchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // Track which reel is in view → single active player.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            const idx = Number((e.target as HTMLElement).dataset.idx);
            if (!Number.isNaN(idx)) setActive(idx);
          }
        }
      },
      { threshold: [0.6] },
    );
    sectionRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [reels.length]);

  // The active player streams state over postMessage (we subscribe via the
  // "listening" handshake in killCaptions). Reveal the iframe the moment it
  // actually starts PLAYING so the poster shows during the cold-start instead
  // of a black frame.
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (typeof e.origin === "string" && !e.origin.includes("youtube")) return;
      const state = parseYouTubePlayerState(e.data);
      if (state === null) return;
      // [reeldiag] temporary instrumentation — remove after diagnosing playback.
      console.log(`[reeldiag] playerState=${state} active=${activeRef.current} muted=${mutedRef.current}`);
      if (state !== YT_STATE_PLAYING) return;
      setRevealedIdx(activeRef.current);
      // Now that it's actually playing, apply the user's sound choice. Unmuting a
      // PLAYING video (after the user's scroll/tap gesture) is allowed, whereas
      // unmuting during load is not.
      if (!mutedRef.current) {
        const post = (func: string, args: unknown[] = []) =>
          (e.source as Window | null)?.postMessage(
            JSON.stringify({ event: "command", func, args }),
            "*",
          );
        console.log("[reeldiag] unmuting active reel post-play");
        post("unMute");
        post("setVolume", [100]);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // "Watched" → capped XP after the dwell threshold on the active reel.
  useEffect(() => {
    const reel = reels[active];
    if (!reel) return;
    if (watched.current.has(reel.id)) return;
    if (watchTimer.current) clearTimeout(watchTimer.current);
    watchTimer.current = setTimeout(async () => {
      if (watched.current.has(reel.id)) return;
      watched.current.add(reel.id);
      const res = await onWatch(reel.id);
      if (res.ok && (res.xpAwarded ?? 0) > 0) flash(`+${res.xpAwarded} XP · nice`);
    }, REEL_WATCH_MS);
    return () => {
      if (watchTimer.current) clearTimeout(watchTimer.current);
    };
  }, [active, reels, onWatch, flash]);

  // YouTube's caption track collides with our overlay and cc_load_policy alone
  // doesn't stop forced captions. Talk to the embedded player over the IFrame
  // API: announce we're "listening", then unload the caption modules. Repeated
  // because the player only accepts commands once it's initialised.
  const killCaptions = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const win = e.currentTarget.contentWindow;
    if (!win) return;
    const post = (msg: object) => win.postMessage(JSON.stringify(msg), "*");
    const send = () => {
      post({ event: "listening", id: 1, channel: "widget" });
      for (const mod of ["captions", "cc"]) {
        post({ event: "command", func: "unloadModule", args: [mod], id: 1, channel: "widget" });
        post({ event: "command", func: "setOption", args: [mod, "track", {}], id: 1, channel: "widget" });
      }
      // ALWAYS load muted — a browser blocks audible autoplay without a gesture,
      // so unmuting here pauses the video and it never starts. We unmute only
      // AFTER it's actually playing (see the message listener), which is allowed.
      post({ event: "command", func: "mute", args: [], id: 1, channel: "widget" });
    };
    send();
    for (const t of [400, 900, 1600, 2600, 4000]) setTimeout(send, t);
  };

  const cmd = (func: string, args: unknown[] = []) => {
    activeFrameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*",
    );
  };

  // Guarantee no reel audio survives a route change: on unmount, blank the
  // active iframe's src (Next.js also removes the node, but this is belt-and-
  // suspenders in case the browser keeps the frame alive momentarily).
  useEffect(() => {
    const frame = activeFrameRef;
    return () => {
      const win = frame.current?.contentWindow;
      win?.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
      if (frame.current) frame.current.src = "about:blank";
    };
  }, []);

  // Metric #11 (Architecture/12) — reels shallow-engagement. Fire `reels_opened`
  // on mount (denominator) and the total VISIBLE seconds on this visit when the
  // user navigates away (numerator input; < 60s total/week = shallow). Only
  // counts time while the tab is actually visible, so a backgrounded tab doesn't
  // inflate dwell.
  useEffect(() => {
    void trackReelsOpened();
    let acc = 0;
    let start: number | null =
      typeof document !== "undefined" && document.visibilityState === "visible"
        ? Date.now()
        : null;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        start = Date.now();
      } else if (start != null) {
        acc += Date.now() - start;
        start = null;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (start != null) acc += Date.now() - start;
      void trackReelsScreenTime(acc / 1000);
    };
  }, []);

  const pauseActive = () => cmd("pauseVideo");

  // Reels autoplay muted (browser policy); this is the in-app sound toggle that
  // replaces YouTube's own control (hidden by controls=0). The choice persists
  // across reels via mutedRef, re-applied when each new reel loads.
  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    cmd(next ? "mute" : "unMute");
    if (!next) cmd("setVolume", [100]);
  };

  // Open the full Short on YouTube in a new tab; keep the app on the reel screen
  // and just pause the in-app player so nothing plays twice.
  const openInYouTube = () => {
    const reel = reels[active];
    if (!reel) return;
    window.open(
      `https://www.youtube.com/shorts/${reel.youtubeId}`,
      "_blank",
      "noopener,noreferrer",
    );
    pauseActive();
    flash("Opened on YouTube · paused here");
  };

  const toggle = async (reel: Reel, type: ToggleType) => {
    if (type === "like") {
      const on = !liked.has(reel.id);
      setLiked((s) => toggleSet(s, reel.id, on));
      const r = await onToggle(reel.id, "like");
      if (!r.ok) setLiked((s) => toggleSet(s, reel.id, !on));
    } else if (type === "save") {
      const on = !saved.has(reel.id);
      setSaved((s) => toggleSet(s, reel.id, on));
      const r = await onToggle(reel.id, "save");
      if (!r.ok) setSaved((s) => toggleSet(s, reel.id, !on));
      else flash(on ? "Saved to your profile" : "Removed from saved");
    } else if (type === "share") {
      const url = `https://www.youtube.com/shorts/${reel.youtubeId}`;
      try {
        if (navigator.share) await navigator.share({ title: reel.title, url });
        else {
          await navigator.clipboard.writeText(url);
          flash("Link copied");
        }
        setShared((s) => new Set(s).add(reel.id));
        onToggle(reel.id, "share");
      } catch {
        /* user dismissed the share sheet — no-op */
      }
    } else {
      // Report opens a reason sheet first (no blocking window.prompt).
      if (reported.has(reel.id)) {
        flash("Already reported");
        return;
      }
      setReportFor(reel);
    }
  };

  const doReport = async (reason: string) => {
    const reel = reportFor;
    if (!reel) return;
    setReportFor(null);
    if (reported.has(reel.id)) return;
    setReported((s) => new Set(s).add(reel.id));
    await onToggle(reel.id, "report", reason);
    flash("Thanks, flagged for review");
  };

  if (reels.length === 0) {
    return (
      <div className="reels-empty">
        <span className="re-emoji" aria-hidden="true">
          🎬
        </span>
        <h2>You&apos;re all caught up</h2>
        <p>
          Fresh AI-in-HR reels drop daily, come back tomorrow (your streak will thank you).
        </p>
      </div>
    );
  }

  return (
    <div className="reels-shell">
      <button
        type="button"
        className="reel-sound"
        onClick={toggleSound}
        aria-pressed={!muted}
        aria-label={muted ? "Unmute" : "Mute"}
        title={muted ? "Unmute" : "Mute"}
      >
        {muted ? "🔇" : "🔊"}
      </button>
      <button
        type="button"
        className="reel-expand"
        onClick={openInYouTube}
        aria-label="Open this reel on YouTube"
        title="Open on YouTube"
      >
        ⛶
      </button>
      <div className="reels" ref={scrollerRef}>
      {reels.map((reel, i) => {
        const isActive = i === active;
        return (
          <section
            className="reel-slide"
            key={reel.id}
            data-idx={i}
            ref={(el) => {
              sectionRefs.current[i] = el;
            }}
          >
            <div className="reel-media">
              {/* Poster always sits behind; the active iframe fades in over it
                  once the player is actually PLAYING (no black cold-start frame). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="reel-poster"
                src={`https://i.ytimg.com/vi/${reel.youtubeId}/hqdefault.jpg`}
                alt={reel.title}
                loading="lazy"
              />
              {isActive && (
                <iframe
                  ref={activeFrameRef}
                  className={`reel-frame${i === active && revealedIdx === active ? " reveal" : ""}`}
                  src={`https://www.youtube.com/embed/${reel.youtubeId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${reel.youtubeId}&controls=0&cc_load_policy=0&iv_load_policy=3&fs=0&disablekb=1&enablejsapi=1`}
                  title={reel.title}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  onLoad={killCaptions}
                />
              )}
              {/* Loading spinner over the poster until the active reel plays, so a
                  slow connection reads as "loading", not "stuck". */}
              {isActive && revealedIdx !== active && <div className="reel-spinner" aria-hidden />}
            </div>

            <div className="reel-shade" />

            <div className="reel-meta">
              {reel.topic && <span className="reel-tag">#{reel.topic}</span>}
              <h3 className="reel-title">{reel.title}</h3>
              {reel.channel && <span className="reel-chan">{reel.channel}</span>}
            </div>

            <div className="reel-rail">
              <button
                type="button"
                className={`rr-btn ${liked.has(reel.id) ? "on" : ""}`}
                onClick={() => toggle(reel, "like")}
                aria-pressed={liked.has(reel.id)}
                aria-label="Like"
              >
                <span>{liked.has(reel.id) ? "❤️" : "🤍"}</span>
                <i>Like</i>
              </button>
              <button
                type="button"
                className={`rr-btn ${saved.has(reel.id) ? "on" : ""}`}
                onClick={() => toggle(reel, "save")}
                aria-pressed={saved.has(reel.id)}
                aria-label="Save"
              >
                <span><BookmarkIcon filled={saved.has(reel.id)} /></span>
                <i>Save</i>
              </button>
              <button
                type="button"
                className={`rr-btn ${shared.has(reel.id) ? "on" : ""}`}
                onClick={() => toggle(reel, "share")}
                aria-label="Share"
              >
                <span>↗️</span>
                <i>Share</i>
              </button>
              <button
                type="button"
                className={`rr-btn ${reported.has(reel.id) ? "on" : ""}`}
                onClick={() => toggle(reel, "report")}
                aria-haspopup="menu"
                aria-label="Report"
              >
                <span>⚑</span>
                <i>Report</i>
              </button>
            </div>

          </section>
        );
      })}
      </div>

      {reportFor && (
        <div
          className="reel-report-scrim"
          role="dialog"
          aria-modal="true"
          aria-label="Report this reel"
          onClick={() => setReportFor(null)}
        >
          <div className="reel-report-sheet" onClick={(e) => e.stopPropagation()}>
            <h4>Report this reel</h4>
            <p>What&apos;s wrong with it? This flags it for review.</p>
            {REPORT_REASONS.map((r) => (
              <button key={r} type="button" className="rrs-opt" onClick={() => doReport(r)}>
                {r}
              </button>
            ))}
            <button type="button" className="rrs-cancel" onClick={() => setReportFor(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {toast && <div className="reel-toast">{toast}</div>}
    </div>
  );
}

function toggleSet(s: Set<number>, id: number, on: boolean): Set<number> {
  const next = new Set(s);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

/** Bookmark glyph for the Save action — outline when not saved, filled when
 *  saved. A bookmark (not the old 🏷️ tag) is the universal "save" affordance,
 *  so users don't mistake Like (❤️) for the save-to-second-brain action. */
function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24" width="22" height="22" aria-hidden focusable="false"
      fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}
