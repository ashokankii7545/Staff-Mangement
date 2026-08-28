/* German Homeopathy – Staff Attendance Service Worker
 * Strategy: network-first for navigations & API, stale-while-revalidate for the
 * hashed build assets (Vite fingerprinted names never change content).
 * Uploads (selfies/avatars) are NEVER cached so the latest face evidence is
 * always fetched fresh.
 */
const CACHE_NAME = 'staff-attendance-v1';

/* Asset requests only – skip data & upload endpoints. */
const isCacheableAsset = (url) => {
  const pathname = url.pathname;
  if (pathname.startsWith('/uploads')) return false;
  if (pathname.startsWith('/graphql')) return false;
  if (url.origin === self.location.origin) return true;
  return false;
};

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin (fonts, CDNs, maps) – cache-first with network update.
  if (!isCacheableAsset(url)) return;

  // SPA navigations: network-first, fall back to cached shell for offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  // Hashed assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});