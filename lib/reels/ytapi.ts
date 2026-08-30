/**
 * Loads Google's official YouTube IFrame Player API (https://www.youtube.com/iframe_api)
 * exactly once and resolves when `window.YT.Player` is ready to use.
 *
 * We moved off hand-rolled `postMessage` control of the embed (which dropped
 * commands and never reliably streamed player-state events) to this API because
 * it gives real `onReady` / `onStateChange` callbacks and dependable
 * `mute()` / `unMute()` / `getPlayerState()` — the reliability the reels sound
 * logic depends on. The script tag is injected once; concurrent callers share the
 * same in-flight promise, and once loaded every caller resolves immediately.
 */

// Minimal shape of the YouTube IFrame API surface we use (avoids a @types dep).
export type YTPlayer = {
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (v: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  // Swap the video in this SAME player (keeps the player's user-activated audio
  // permission, so sound carries across reels) and autoplay it.
  loadVideoById: (videoId: string) => void;
  getPlayerState: () => number;
  getIframe: () => HTMLIFrameElement;
  destroy: () => void;
};

export type YTPlayerEvent = { target: YTPlayer; data: number };

export type YTPlayerOptions = {
  videoId: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (e: YTPlayerEvent) => void;
    onStateChange?: (e: YTPlayerEvent) => void;
  };
};

export type YTNamespace = {
  Player: new (el: HTMLElement | string, opts: YTPlayerOptions) => YTPlayer;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
};

type WindowWithYT = Window & {
  YT?: YTNamespace;
  onYouTubeIframeAPIReady?: () => void;
};

let apiPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API unavailable on the server"));
  }
  const w = window as WindowWithYT;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve) => {
    // The API invokes this global once it finishes loading. Chain any existing
    // handler so we don't clobber another integration on the page.
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(w.YT as YTNamespace);
    };
    // If some other code already added the script, don't add it twice.
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
  return apiPromise;
}
