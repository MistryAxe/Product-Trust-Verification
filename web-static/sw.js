// Minimal service worker: it makes the website installable ("Install app" / "Add to Home screen").
// It deliberately caches nothing, so people always get the newest version and live data.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
