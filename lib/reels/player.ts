/**
 * Parse a `postMessage` sent by an embedded YouTube IFrame player and return the
 * player-state code, or null if the message isn't a state update. We subscribe to
 * these by posting the `{event:"listening"}` handshake to the player (see
 * ReelsFeed.killCaptions); the player then streams state as JSON strings like:
 *   {"event":"onStateChange","info":1}                       (older shape)
 *   {"event":"infoDelivery","info":{"playerState":1,...}}    (common shape)
 * State codes: -1 unstarted · 0 ended · 1 playing · 2 paused · 3 buffering · 5 cued.
 */
export function parseYouTubePlayerState(data: unknown): number | null {
  if (typeof data !== "string") return null;
  let msg: unknown;
  try {
    msg = JSON.parse(data);
  } catch {
    return null;
  }
  if (!msg || typeof msg !== "object") return null;
  const m = msg as { event?: unknown; info?: unknown };
  if (m.event === "onStateChange" && typeof m.info === "number") return m.info;
  if (m.event === "infoDelivery" && m.info && typeof m.info === "object") {
    const ps = (m.info as { playerState?: unknown }).playerState;
    if (typeof ps === "number") return ps;
  }
  return null;
}

/** YouTube player state = actively playing. We reveal the iframe (over the poster) here. */
export const YT_STATE_PLAYING = 1;
