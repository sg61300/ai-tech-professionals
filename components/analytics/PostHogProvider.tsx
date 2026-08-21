'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

/**
 * Initializes PostHog on the client once. No-op when the key is absent (local
 * dev / preview without analytics). Identify happens after auth, elsewhere.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || typeof window === 'undefined') return;
    if (posthog.__loaded) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      capture_pageview: true,
      person_profiles: 'identified_only',
    });
  }, []);

  return <>{children}</>;
}

export default PostHogProvider;
