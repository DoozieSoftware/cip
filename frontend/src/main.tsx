import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root is missing in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.DEV) {
  // Web Push requires a service worker, so dev registers one — but the
  // production caching strategy must never run against the dev server: its
  // cache-first assets and precached /citizen/ shell serve stale built HTML
  // for module scripts ("Expected a JavaScript-or-Wasm module script...
  // MIME type text/html"). The ?dev=1 variant of sw.js skips all caching
  // and wipes leftover caches on activation while keeping push/sync.
  // Any previous registration is removed first so every dev session starts
  // from a fresh worker.
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      .then(() => navigator.serviceWorker.register('/sw.js?dev=1'))
      .catch((error) => {
        console.warn('Dev service worker registration failed:', error);
      });
  });
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  });
}
