// Minimal service worker — makes the app installable (PWA) in Slice 0.
// Network-first, no aggressive caching yet; real offline/precache strategy is a
// later slice. Kept intentionally tiny so it can't serve stale app shells in dev.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // pass-through: let the network handle everything for now.
});
