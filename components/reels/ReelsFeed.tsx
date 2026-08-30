"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REEL_WATCH_MS } from "@/lib/reels";
import { loadYouTubeApi, type YTNamespace, type YTPlayer } from "@/lib/reels/ytapi";
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

// Player options shared by every video the single player loads.
const PLAYER_VARS = {
  autoplay: 1,
  mute: 1, // muted autoplay is the only kind browsers allow at load
  controls: 0,
  playsinline: 1,
  rel: 0,
  modestbranding: 1,
  cc_load_policy: 0,
  iv_load_policy: 3,
  fs: 0,
  disablekb: 1,
} as const;

/**
 * Reels feed backed by ONE persistent YouTube player.
 *
 * Why a single player: the browser only lets a cross-origin YouTube player play
 * WITH SOUND if that exact player was unmuted in response to a user gesture. A
 * per-reel player (one iframe each) therefore stalls the moment we auto-unmute it
 * on scroll — every new player lacks the gesture. So instead we keep ONE player,
 * unmuted once by the user's tap, and swap the video via `loadVideoById` as they
 * scroll — the same user-activated player keeps its sound across every reel.
 *
 * Layout: the scroller holds one poster per reel (the visual filmstrip + scroll
 * targets); a single fixed <div className="reel-stage"> overlays the player above
 * the posters; the active reel's chrome (title / rail / buttons) sits in a fixed
 * layer above the player. The player element never moves in the DOM (reparenting
 * an iframe reloads it and loses the audio permission).
 */
export function ReelsFeed({
  reels,
  initialLiked,
  initialSaved,
  watchedIds,
  onToggle,
  onWatch,
}: ReelsFeedProps) {
  const [active, setActive] = useState(0);
  // The index the player is actually PLAYING. While it differs from `active` the
  // stage stays hidden and the active reel's poster + spinner show (during load).
  const [revealedIdx, setRevealedIdx] = useState<number | null>(null);
  const activeRef = useRef(0);

  const [liked, setLiked] = useState<Set<number>>(new Set(initialLiked));
  const [saved, setSaved] = useState<Set<number>>(new Set(initialSaved));
  const [shared, setShared] = useState<Set<number>>(new Set());
  const [reported, setReported] = useState<Set<number>>(new Set());
  const [reportFor, setReportFor] = useState<Reel | null>(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const watched = useRef<Set<number>>(new Set(watchedIds));
  const mutedRef = useRef(true);
  // The youtubeId currently loaded in the single player. We reload ONLY when this
  // actually changes — so a revalidation (Save / Like / the 15s watch-XP fire all
  // call revalidatePath("/reels"), handing us a fresh `reels` prop) never reloads
  // the same reel. A non-gesture reload would get its unmuted audio blocked by the
  // browser, which is why Save was silencing the reel.
  const loadedVideoRef = useRef<string | null>(null);
  // Latest reels, read inside the create effect so that effect can depend only on
  // `apiReady` — the single player is created ONCE and never destroyed/recreated
  // when a revalidation hands us a new `reels` array (which would drop the user's
  // unmute and remute the fresh player).
  const reelsRef = useRef(reels);
  useEffect(() => {
    reelsRef.current = reels;
  });

  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const stageHostRef = useRef<HTMLDivElement | null>(null);
  const ytRef = useRef<YTNamespace | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const watchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // Load the IFrame API once.
  useEffect(() => {
    let alive = true;
    loadYouTubeApi()
      .then((yt) => {
        if (!alive) return;
        ytRef.current = yt;
        setApiReady(true);
      })
      .catch(() => {
        /* offline / blocked — posters remain, nothing crashes */
      });
    return () => {
      alive = false;
    };
  }, []);

  // Track which reel is in view → drives the single player + chrome.
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

  // Create the single player once the API + host are ready, pointed at reel 0.
  useEffect(() => {
    const yt = ytRef.current;
    const host = stageHostRef.current;
    if (!apiReady || !yt || !host || playerRef.current) return;
    // Use the current active reel (the user may have scrolled while the API loaded).
    const current = reelsRef.current;
    const first = current[activeRef.current] ?? current[0];
    if (!first) return;
    loadedVideoRef.current = first.youtubeId;

    const mount = document.createElement("div");
    host.appendChild(mount);
    playerRef.current = new yt.Player(mount, {
      videoId: first.youtubeId,
      playerVars: {
        ...PLAYER_VARS,
        origin: typeof window !== "undefined" ? window.location.origin : "",
      },
      events: {
        onReady: (e) => {
          e.target.getIframe()?.classList.add("reel-stage-media");
        },
        onStateChange: (e) => {
          const S = yt.PlayerState;
          if (e.data === S.PLAYING) {
            setRevealedIdx(activeRef.current);
            setPaused(false);
          } else if (e.data === S.ENDED) {
            // Reliable loop — loadVideoById drops the playlist loop, so replay here.
            try {
              e.target.seekTo(0, true);
              e.target.playVideo();
            } catch {
              /* torn down */
            }
          }
        },
      },
    });

    return () => {
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, [apiReady]);

  // On active change, swap the video in the SAME player. The player keeps its
  // muted/unmuted state across the swap, so once the user has unmuted (a gesture)
  // sound follows every reel. The stage hides (revealedIdx still points at the old
  // reel) until the new video reports PLAYING.
  useEffect(() => {
    activeRef.current = active;
    const player = playerRef.current;
    const reel = reels[active];
    if (!player || !reel) return;
    // Same reel already loaded (e.g. a revalidation re-ran this effect) → do NOT
    // reload, or we'd interrupt playback and lose the unmuted-audio permission.
    if (loadedVideoRef.current === reel.youtubeId) return;
    loadedVideoRef.current = reel.youtubeId;
    try {
      player.loadVideoById(reel.youtubeId);
    } catch {
      /* not ready yet — the create effect points it at the active reel */
    }
    // Safety net: never let a reel sit on the spinner forever.
    const safety = setTimeout(() => setRevealedIdx(activeRef.current), 3000);
    return () => clearTimeout(safety);
  }, [active, reels]);

  // Tear the player down on unmount so no reel keeps playing after a route change.
  useEffect(() => {
    return () => {
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
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

  // Metric #11 (Architecture/12) — reels shallow-engagement. `reels_opened` on
  // mount (denominator) + total VISIBLE seconds when the user leaves (numerator).
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

  // The in-app sound toggle. Runs inside the user's click (a gesture), so the
  // browser lets us actually unmute — and because it's the one persistent player,
  // the choice then holds for every reel we load.
  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    const player = playerRef.current;
    if (!player) return;
    try {
      if (next) player.mute();
      else {
        player.unMute();
        player.setVolume(100);
        player.playVideo();
      }
    } catch {
      /* ignore */
    }
  };

  // Tap the video to toggle play / pause (clicks pass through the transparent
  // stage + chrome to the scroller, which owns this handler). It's a user gesture,
  // so resuming is always allowed.
  const togglePlayPause = () => {
    const player = playerRef.current;
    const yt = ytRef.current;
    if (!player || !yt) return;
    try {
      if (player.getPlayerState() === yt.PlayerState.PLAYING) {
        player.pauseVideo();
        setPaused(true);
      } else {
        player.playVideo();
        setPaused(false);
      }
    } catch {
      /* ignore */
    }
  };

  // Open the full Short on YouTube in a new tab; pause the in-app player so
  // nothing plays twice.
  const openInYouTube = () => {
    const reel = reels[active];
    if (!reel) return;
    window.open(
      `https://www.youtube.com/shorts/${reel.youtubeId}`,
      "_blank",
      "noopener,noreferrer",
    );
    try {
      playerRef.current?.pauseVideo();
      setPaused(true);
    } catch {
      /* ignore */
    }
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

  const activeReel = reels[active];
  const revealed = revealedIdx === active;

  return (
    <div className="reels-shell">
      {/* Poster filmstrip — one per reel; the scroll targets + what shows while a
          reel loads (the single player stage sits above these). A tap here (which
          passes through the transparent stage + chrome) toggles play / pause. */}
      <div className="reels" ref={scrollerRef} onClick={togglePlayPause}>
        {reels.map((reel, i) => (
          <section
            className="reel-slide"
            key={reel.id}
            data-idx={i}
            ref={(el) => {
              sectionRefs.current[i] = el;
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="reel-poster"
              src={`https://i.ytimg.com/vi/${reel.youtubeId}/hqdefault.jpg`}
              alt={reel.title}
              loading="lazy"
            />
          </section>
        ))}
      </div>

      {/* The ONE player. Fixed over the active poster; fades in when its video is
          actually PLAYING so loads read as the poster, not a black frame. */}
      <div className={`reel-stage${revealed ? " reveal" : ""}`}>
        <div className="reel-stage-host" ref={stageHostRef} />
      </div>
      {!revealed && <div className="reel-spinner" aria-hidden />}
      {paused && revealed && (
        <div className="reel-paused" aria-hidden>
          <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}

      {/* Chrome for the active reel — above the player. */}
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

      {activeReel && (
        <div className="reel-chrome">
          <div className="reel-shade" />
          <div className="reel-meta">
            {activeReel.topic && <span className="reel-tag">#{activeReel.topic}</span>}
            <h3 className="reel-title">{activeReel.title}</h3>
            {activeReel.channel && <span className="reel-chan">{activeReel.channel}</span>}
          </div>

          <div className="reel-rail">
            <button
              type="button"
              className={`rr-btn ${liked.has(activeReel.id) ? "on" : ""}`}
              onClick={() => toggle(activeReel, "like")}
              aria-pressed={liked.has(activeReel.id)}
              aria-label="Like"
            >
              <span>{liked.has(activeReel.id) ? "❤️" : "🤍"}</span>
              <i>Like</i>
            </button>
            <button
              type="button"
              className={`rr-btn ${saved.has(activeReel.id) ? "on" : ""}`}
              onClick={() => toggle(activeReel, "save")}
              aria-pressed={saved.has(activeReel.id)}
              aria-label="Save"
            >
              <span><BookmarkIcon filled={saved.has(activeReel.id)} /></span>
              <i>Save</i>
            </button>
            <button
              type="button"
              className={`rr-btn ${shared.has(activeReel.id) ? "on" : ""}`}
              onClick={() => toggle(activeReel, "share")}
              aria-label="Share"
            >
              <span>↗️</span>
              <i>Share</i>
            </button>
            <button
              type="button"
              className={`rr-btn ${reported.has(activeReel.id) ? "on" : ""}`}
              onClick={() => toggle(activeReel, "report")}
              aria-haspopup="menu"
              aria-label="Report"
            >
              <span>⚑</span>
              <i>Report</i>
            </button>
          </div>
        </div>
      )}

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
