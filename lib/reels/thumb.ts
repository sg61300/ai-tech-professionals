/**
 * Derive display data for a *saved* reel from the URL we stored in
 * `saved_artifacts.body`. A saved reel's body is `https://www.youtube.com/shorts/<id>`
 * (see `reelUrl()` in app/(app)/reels/actions.ts), or the fallback `reel:<numericId>`
 * when a reel row had no `youtube_id`. These are pure so they can be unit-tested and
 * run on both server and client with no I/O.
 */

/** Pull the YouTube video id out of a saved-reel body URL, or null if there isn't one. */
export function youtubeIdFromReelUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Shorts: https://www.youtube.com/shorts/<id>
  const shorts = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/);
  if (shorts) return shorts[1];
  // Defensive: also accept classic watch URLs in case older rows exist.
  const watch = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  if (watch) return watch[1];
  const youtu = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (youtu) return youtu[1];
  return null;
}

/** hqdefault thumbnail for the reel, or null when we can't derive a YouTube id. */
export function reelThumbUrl(url: string | null | undefined): string | null {
  const id = youtubeIdFromReelUrl(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

/** The URL to open when the user taps the reel, or null for a non-openable fallback body. */
export function reelWatchUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  return null; // `reel:<id>` and other non-http bodies aren't externally openable
}
