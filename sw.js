/*
 * Service worker: lets Crossword Hub install as an app and work offline.
 * VERSION must match the ?v= number on the scripts and stylesheet in
 * index.html (the tests check this). Bumping it replaces the cached copy.
 */
const VERSION = 23;
const CACHE = `crossword-hub-v${VERSION}`;
const FONT_CACHE = 'crossword-hub-fonts';
const SHELL = [
  './',
  'manifest.webmanifest',
  `css/styles.css?v=${VERSION}`,
  `js/generator.js?v=${VERSION}`,
  `js/words.js?v=${VERSION}`,
  `js/collections.js?v=${VERSION}`,
  `js/genres.js?v=${VERSION}`,
  `js/sync.js?v=${VERSION}`,
  `js/featured.js?v=${VERSION}`,
  `js/hints.js?v=${VERSION}`,
  `js/stats.js?v=${VERSION}`,
  `js/access.js?v=${VERSION}`,
  `js/share.js?v=${VERSION}`,
  `js/analytics.js?v=${VERSION}`,
  `js/app.js?v=${VERSION}`,
  `js/firebase-config.js?v=${VERSION}`,
  `js/account.js?v=${VERSION}`,
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Pages: try the network for the latest version, fall back to the saved copy offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./', copy));
          return response;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  // Google Fonts: use the saved copy at once and refresh it in the background.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fresh = fetch(request).then((response) => {
            cache.put(request, response.clone());
            return response;
          });
          return cached || fresh;
        })
      )
    );
    return;
  }

  // Scripts, styles and icons: their URLs change with each version, so the
  // saved copy is always right.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
  }
});
