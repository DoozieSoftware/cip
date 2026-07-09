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
 *      - GET navigation requests fall back to the cached app shell when
 *        offline so the SPA still boots
 *      - static assets (Vite bundles, images) are cache-first
 *  - on `sync` (background sync API): ping every open client so its
 *    IndexedDB queue drains. The SPA owns the queue; the SW just
 *    wakes the client up.
 *  - on `push`: show a Notification (with the platform's icon and a
 *    `data.url` payload) and forward the payload to any open client
 *    so the in-app inbox updates.
 *
 * Offline submission of new reports is handled in the SPA via the
 * IndexedDB queue (T-M13-006). This SW only caches GETs; mutations
 * are intercepted and queued by the SPA before they hit the network.
 */

const VERSION = 'cip-sw-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const SYNC_TAG = 'cip-queue-drain';

const APP_SHELL = [
  '/',
  '/login',
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
  return /\.(?:js|css|woff2?|ttf|otf|svg|png|jpg|jpeg|webp|ico|map)$/.test(url.pathname);
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
          // Only cache successful, basic/cors responses — opaque responses
          // (e.g. cross-origin media) would explode the runtime cache.
          if (response && response.ok && response.type !== 'opaque') {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
          }
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
          if (response && response.ok && response.type !== 'opaque') {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
          }
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
        const cached = await caches.match('/');
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

/* ------------------------------------------------------------------ *
 * Background sync — when connectivity returns, wake the SPA so its
 * IndexedDB queue drains. The SW does not own the queue, by design.
 * ------------------------------------------------------------------ */

self.addEventListener('sync', (event) => {
  if (event.tag !== SYNC_TAG) return;
  event.waitUntil(notifyClients({ type: 'queue:drain' }));
});

/* ------------------------------------------------------------------ *
 * Push — show a system notification and forward the payload to any
 * open client so the in-app inbox updates in real time.
 * ------------------------------------------------------------------ */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = { title: 'Civic update', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'Civic update';
  const body = payload.body || '';
  const url = payload.url || '/notifications';
  const tag = payload.tag || 'cip-notification';

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body,
        tag,
        icon: '/icons/icon-192.svg',
        badge: '/icons/icon-192.svg',
        data: { url },
      });
      await notifyClients({ type: 'push:received', payload: { title, body, url, tag } });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/notifications';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({ type: 'push:navigate', url });
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});

async function notifyClients(message) {
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of all) {
    client.postMessage(message);
  }
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'queue:request-sync') {
    // The SPA asked the SW to register a background-sync tag. If
    // the browser does not support the API, fall back to a client
    // broadcast so the SPA can drain immediately.
    if ('sync' in self.registration) {
      self.registration.sync.register(SYNC_TAG).catch(() => notifyClients({ type: 'queue:drain' }));
    } else {
      notifyClients({ type: 'queue:drain' });
    }
  }
});
