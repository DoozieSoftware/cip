/**
 * T-M13-017 — Web Push subscription.
 *
 *  - Subscribes the browser to push notifications.
 *  - Sends the resulting `PushSubscription` JSON to the
 *    backend (`POST /api/v1/notifications/push/subscriptions`).
 *  - Unsubscribes on logout (called by AuthContext).
 *  - Falls back to a no-op when the browser does not
 *    support push or permission is denied.
 */

import { apiRequest } from '../../../auth/api';

const PUSH_STORAGE_KEY = 'cip.push.subscription.endpoint';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export interface PushSupport {
  supported: boolean;
  permission: NotificationPermission | null;
}

export function pushSupport(): PushSupport {
  const notification = typeof Notification === 'undefined' ? null : Notification;

  if (
    typeof window === 'undefined' ||
    notification === null ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return { supported: false, permission: null };
  }

  // Some jsdom/browser shims expose Notification without the permission
  // property. Treat that partial API as unsupported instead of leaking
  // `undefined` through a contract that promises NotificationPermission|null.
  const permission = notification.permission;
  if (permission !== 'default' && permission !== 'denied' && permission !== 'granted') {
    return { supported: false, permission: null };
  }

  return { supported: true, permission };
}

export interface SubscribeOptions {
  applicationServerKey?: string | null;
  subscribeUrl?: string;
}

export interface SubscribeResult {
  ok: boolean;
  reason?:
    | 'unsupported'
    | 'permission_denied'
    | 'no_service_worker'
    | 'subscription_failed'
    | 'persist_failed';
  /** Human-readable detail for the failing branch — surfaced in the toast. */
  detail?: string;
  subscription?: PushSubscriptionJSON;
}

async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;

  // Registration normally happens from main.tsx after page load. The user can
  // still reach the toggle before that asynchronous work finishes, or a prior
  // registration may have been removed while rotating push credentials. Make
  // enabling push self-contained instead of asking the user to keep reloading.
  const scriptUrl = import.meta.env.DEV ? '/sw.js?dev=1' : '/sw.js';
  return navigator.serviceWorker.register(scriptUrl);
}

/**
 * Resolve the VAPID public key. The backend endpoint is the single
 * source of truth: it returns the public half of the exact keypair the
 * delivery services sign with, so the subscription can never drift from
 * the sender (a drift makes the push provider reject sends with
 * "403 VAPID" errors and the notification silently never appears).
 *
 * `VITE_VAPID_PUBLIC_KEY` is only a last-resort local-dev fallback for
 * when the API is unreachable, and it must hold the same public key as
 * the backend's VAPID_PUBLIC_KEY.
 */
async function resolveVapidKey(provided?: string | null): Promise<string | null> {
  if (provided) return provided;
  try {
    const res = await apiRequest<{ data: { public_key: string } }>(
      '/notifications/push/vapid-public-key',
    );
    const backendKey = res.data.public_key ?? null;
    if (backendKey) return backendKey;
  } catch {
    // API unreachable — fall through to the build-time fallback below.
  }
  return import.meta.env.VITE_VAPID_PUBLIC_KEY ?? null;
}

/**
 * Subscribe the active service worker. Returns a result the
 * caller can show in a toast.
 */
export async function subscribeToPush(opts: SubscribeOptions = {}): Promise<SubscribeResult> {
  const support = pushSupport();
  if (!support.supported) return { ok: false, reason: 'unsupported' };
  if (support.permission === 'denied') return { ok: false, reason: 'permission_denied' };

  if (support.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, reason: 'permission_denied' };
  }

  const vapidKey = await resolveVapidKey(opts.applicationServerKey ?? null);
  if (!vapidKey)
    return { ok: false, reason: 'subscription_failed', detail: 'No VAPID public key configured.' };

  let sub: PushSubscription;
  let registration: ServiceWorkerRegistration | undefined;
  try {
    registration = await ensureServiceWorkerRegistration();
    // Wait for an *active* worker rather than only an installing registration.
    // PushManager cannot subscribe until activation has completed.
    await navigator.serviceWorker.ready;
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
    });
  } catch (err) {
    if (!registration) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      return { ok: false, reason: 'no_service_worker', detail };
    }

    // A VAPID key rotation leaves an existing browser subscription bound to
    // the old key. Remove that stale subscription and retry once with the
    // current key; ordinary provider failures still return a clear error.
    try {
      const existing = await registration?.pushManager.getSubscription();
      if (!existing || !registration) throw err;
      await existing.unsubscribe();
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });
    } catch (retryError) {
      const detail =
        retryError instanceof Error
          ? `${retryError.name}: ${retryError.message}`
          : String(retryError);

      console.error('[push] pushManager.subscribe failed:', retryError);
      return { ok: false, reason: 'subscription_failed', detail };
    }
  }

  const json = sub.toJSON();
  try {
    await apiRequest<unknown>(opts.subscribeUrl ?? '/notifications/push/subscriptions', {
      method: 'POST',
      body: {
        endpoint: json.endpoint,
        keys: json.keys,
        // PushSubscriptionJSON does not expose contentEncoding in current
        // Chromium browsers. RFC 8291 Web Push uses aes128gcm; the legacy
        // aesgcm fallback causes otherwise-valid Brave/Chrome subscriptions
        // to reject encrypted payloads.
        content_encoding: (json as { contentEncoding?: string }).contentEncoding ?? 'aes128gcm',
      },
    });
  } catch {
    // Roll back so the UI does not show a "subscribed" state.
    await sub.unsubscribe().catch(() => undefined);
    return { ok: false, reason: 'persist_failed' };
  }

  if (json.endpoint) {
    try {
      localStorage.setItem(PUSH_STORAGE_KEY, json.endpoint);
    } catch {
      /* noop */
    }
  }
  return { ok: true, subscription: json };
}

/**
 * Unsubscribe and tell the backend.
 */
export async function unsubscribeFromPush(
  opts: { subscribeUrl?: string; endpoint?: string | null } = {},
): Promise<boolean> {
  if (!pushSupport().supported) return true;

  let endpoint =
    opts.endpoint ??
    (typeof localStorage !== 'undefined' ? localStorage.getItem(PUSH_STORAGE_KEY) : null);
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      endpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => undefined);
    }
  } catch {
    // best-effort: continue to notify the backend with the stored endpoint
  }

  if (endpoint) {
    try {
      const url = `${opts.subscribeUrl ?? '/notifications/push/subscriptions'}?endpoint=${encodeURIComponent(endpoint)}`;
      await apiRequest<unknown>(url, { method: 'DELETE' });
    } catch {
      // best-effort
    }
    try {
      localStorage.removeItem(PUSH_STORAGE_KEY);
    } catch {
      /* noop */
    }
  }
  return true;
}
