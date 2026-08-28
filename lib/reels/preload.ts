/**
 * Decide whether to preload the NEXT reel's player based on the viewer's network.
 * Preloading warms the upcoming YouTube player so it starts near-instantly, but it
 * costs extra memory + a little data — so we skip it on slow / metered connections.
 * `conn` is the `navigator.connection` object (Network Information API), which many
 * browsers don't expose — when it's absent we allow preload (typically desktop).
 */
export type NetworkInfoLike = { saveData?: boolean; effectiveType?: string } | null | undefined;

export function shouldPreloadNext(conn: NetworkInfoLike): boolean {
  if (!conn) return true; // no Network Information API → assume a capable connection
  if (conn.saveData) return false; // Data Saver on → never preload
  const et = conn.effectiveType ?? "";
  if (et === "slow-2g" || et === "2g") return false; // too slow to spend data ahead
  return true; // 3g / 4g / unknown-but-present
}
