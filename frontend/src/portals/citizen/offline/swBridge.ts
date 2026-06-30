/**
 * Citizen PWA service-worker bridge (T-M13-007).
 *
 * The IndexedDB queue lives in the SPA. The service worker is
 * a passive cache + push layer. To make offline submissions
 * reliable on flaky networks, the SPA can ask the SW to register
 * a `sync` event so the OS wakes the SW when connectivity is
 * back. The SW then broadcasts a `queue:drain` message back
 * to every open client so its queue drains immediately.
 *
 * This module:
 *  - exposes `requestBackgroundSync()` to enqueue the sync tag.
 *  - exposes `onQueueDrain(handler)` for clients that want to
 *    be notified when the SW pings them.
 *  - exposes `onPushReceived(handler)` so the in-app inbox
 *    refreshes when a push arrives (and the app is in the
 *    foreground).
 *
 * It no-ops in test / SSR environments (no `navigator`).
 */

export type QueueDrainHandler = () => void;
export type PushReceivedPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};
export type PushReceivedHandler = (payload: PushReceivedPayload) => void;

const SW_SYNC_MESSAGE = 'queue:request-sync';

function hasServiceWorker(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

export async function requestBackgroundSync(): Promise<{ registered: boolean }> {
  if (!hasServiceWorker()) return { registered: false };
  try {
    const reg = await navigator.serviceWorker.ready;
    // The SW message handler reads `type: queue:request-sync`
    // and calls `registration.sync.register(...)` if supported.
    if (reg.active) {
      reg.active.postMessage({ type: SW_SYNC_MESSAGE });
      return { registered: true };
    }
    return { registered: false };
  } catch {
    return { registered: false };
  }
}

export function onQueueDrain(handler: QueueDrainHandler): () => void {
  if (!hasServiceWorker()) return () => undefined;
  const listener = (event: MessageEvent): void => {
    const data = event.data as { type?: string } | undefined;
    if (data && data.type === 'queue:drain') {
      handler();
    }
  };
  navigator.serviceWorker.addEventListener('message', listener);
  return () => navigator.serviceWorker.removeEventListener('message', listener);
}

export function onPushReceived(handler: PushReceivedHandler): () => void {
  if (!hasServiceWorker()) return () => undefined;
  const listener = (event: MessageEvent): void => {
    const data = event.data as { type?: string; payload?: PushReceivedPayload } | undefined;
    if (data && data.type === 'push:received' && data.payload) {
      handler(data.payload);
    }
  };
  navigator.serviceWorker.addEventListener('message', listener);
  return () => navigator.serviceWorker.removeEventListener('message', listener);
}

export function onPushNavigate(handler: (url: string) => void): () => void {
  if (!hasServiceWorker()) return () => undefined;
  const listener = (event: MessageEvent): void => {
    const data = event.data as { type?: string; url?: string } | undefined;
    if (data && data.type === 'push:navigate' && data.url) {
      handler(data.url);
    }
  };
  navigator.serviceWorker.addEventListener('message', listener);
  return () => navigator.serviceWorker.removeEventListener('message', listener);
}
