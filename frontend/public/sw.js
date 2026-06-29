/* eslint-disable */
/**
 * Civic Intelligence Platform — Citizen PWA service worker.
 *
 * Strategy:
 *  - pre-cache the app shell on install
 *  - on activate, drop any old caches
 *  - on fetch:
 *      - /api/v1/* requests are network-first; falls back to cached response
 *        (offline reads of the notification preferences, dashboard, etc.)
 *      - GET navigation requests fall back to the cached /citizen shell when
 *        offline so the SPA still boots
 *      - static assets (Vite bundles, images) are cache-first
 *
 * Offline submission of new reports is handled in the SPA via the
 * IndexedDB queue (T-M13-006). This SW only caches GETs; mutations
 * are intercepted and queued by the SPA before they hit the network.
 */

const VERSION = 'cip-sw-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const APP_SHELL = [
  '/',
  '/citizen',
  '/citizen/login',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isStaticAsset(url) {
  return /\\.(?:js|css|woff2?|ttf|otf|svg|png|jpg|jpeg|webp|ico|map)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isApiRequest(url)) {
    // Network-first for API reads; falls back to cache on offline.
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, response.clone());
          return response;
        } catch (err) {
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }
          return new Response(
            JSON.stringify({ success: false, message: 'Offline', code: 'OFFLINE', errors: {} }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
          );
        }
      })(),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }
        try {
          const response = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, response.clone());
          return response;
        } catch (err) {
          return new Response('', { status: 504 });
        }
      })(),
    );
    return;
  }

  // Navigation request: try network, then shell fallback.
  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch (err) {
        const cached = await caches.match('/citizen');
        if (cached) {
          return cached;
        }
        return new Response('<h1>Offline</h1><p>Reconnect to load the app.</p>', {
          status: 503,
          headers: { 'Content-Type': 'text/html' },
        });
      }
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
