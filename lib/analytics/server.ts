import "server-only";
import { PostHog } from "posthog-node";
import type { EventName, EventProps } from "./events";

/**
 * Server-side capture for Server Actions (completions, streak advances). Uses a
 * singleton PostHog client. No-op if the key is unset so local dev never breaks.
 */
let _client: PostHog | null = null;
function client(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!_client) {
    _client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _client;
}

export async function captureServer(
  distinctId: string,
  event: EventName,
  properties?: EventProps,
) {
  const c = client();
  if (!c) return;
  c.capture({ distinctId, event, properties });
  await c.flush().catch(() => {});
}
