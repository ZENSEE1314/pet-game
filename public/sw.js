/**
 * Minimal service worker — enough to make the app installable, and no more.
 *
 * It deliberately does NOT cache API responses. Caching a balance, a cooldown or a
 * claim status would let the app show a player a number that is no longer true, and
 * "your points are stale" is a support ticket at best and an accusation of theft at
 * worst. Only the static shell is cached; everything that can change goes to the
 * network, every time.
 */

const CACHE = 'petquest-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/assets/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never touch the API, auth, or anything cross-origin.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Network-first for navigations, so a deployed change is picked up immediately and
  // the cached shell is only a fallback for genuinely offline use.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }

  // Cache-first for static assets — they're content-hashed, so they can't go stale.
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
