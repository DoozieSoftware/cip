/**
 * Standalone helper that registers the service worker in production.
 * Kept as a separate module so it can be imported once from the
 * top-level App shell without polluting the render tree.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (!('serviceWorker' in navigator)) {
    return;
  }
  if (!import.meta.env.PROD) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((error: unknown) => {
        console.warn('Service worker registration failed:', error);
      });
  });
}
