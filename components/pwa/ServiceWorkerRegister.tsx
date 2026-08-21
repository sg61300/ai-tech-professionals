'use client';

import { useEffect } from 'react';

/** Registers the PWA service worker once, after mount. No-op if unsupported. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    // Register only in production builds to avoid dev HMR interference.
    if (process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration is best-effort; app works without it */
    });
  }, []);
  return null;
}

export default ServiceWorkerRegister;
