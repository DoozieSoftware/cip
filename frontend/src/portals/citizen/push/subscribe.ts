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
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { supported: false, permission: null };
  }
  return { supported: true, permission: Notification.permission };
}

export interface SubscribeOptions {
  applicationServerKey?: string | null;
  subscribeUrl?: string;
}

export interface SubscribeResult {
  ok: boolean;
  reason?: 'unsupported' | 'permission_denied' | 'no_service_worker' | 'subscription_failed' | 'persist_failed';
  /** Human-readable detail for the failing branch — surfaced in the toast. */
  detail?: string;
  subscription?: PushSubscriptionJSON;
}

/**
 * Resolve the VAPID public key: prefer an explicit key, otherwise
 * fetch it from the backend (which reads it from config). Hardcoding
 * the key in the bundle is avoided per security rules.
 */
async function resolveVapidKey(provided?: string | null): Promise<string | null> {
  if (provided) return provided;
  try {
    const res = await apiRequest<{ data: { public_key: string } }>('/notifications/push/vapid-public-key');
    return res.data.public_key ?? null;
  } catch {
    return null;
  }
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
  if (!vapidKey) return { ok: false, reason: 'subscription_failed', detail: 'No VAPID public key configured.' };

  let sub: PushSubscription;
  try {
    // Wait for an *active* worker rather than any registration — you
    // cannot subscribe against a worker that is still installing.
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      return {
        ok: false,
        reason: 'no_service_worker',
        detail: 'Service worker is not registered on this origin. Reload the page and retry.',
      };
    }
    await navigator.serviceWorker.ready;
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
    });
  } catch (err) {
    // The push service rejected the subscription. The most common
    // causes: the browser's push backend is disabled (e.g. Brave
    // disables Google FCM by default), a pre-existing subscription
    // uses a different applicationServerKey, or there is no network
    // route to the push service. Surface the real error so it is
    // diagnosable instead of a generic failure.
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    // eslint-disable-next-line no-console
    console.error('[push] pushManager.subscribe failed:', err);
    return { ok: false, reason: 'subscription_failed', detail };
  }

  const json = sub.toJSON();
  try {
    await apiRequest<unknown>(opts.subscribeUrl ?? '/notifications/push/subscriptions', {
      method: 'POST',
      body: {
        endpoint: json.endpoint,
        keys: json.keys,
        content_encoding: (json as { contentEncoding?: string }).contentEncoding ?? 'aesgcm',
      },
    });
  } catch {
    // Roll back so the UI does not show a "subscribed" state.
    await sub.unsubscribe().catch(() => undefined);
    return { ok: false, reason: 'persist_failed' };
  }

  if (json.endpoint) {
    try { localStorage.setItem(PUSH_STORAGE_KEY, json.endpoint); } catch { /* noop */ }
  }
  return { ok: true, subscription: json };
}

/**
 * Unsubscribe and tell the backend.
 */
export async function unsubscribeFromPush(opts: { subscribeUrl?: string; endpoint?: string | null } = {}): Promise<boolean> {
  if (!pushSupport().supported) return true;

  let endpoint = opts.endpoint ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(PUSH_STORAGE_KEY) : null);
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
    try { localStorage.removeItem(PUSH_STORAGE_KEY); } catch { /* noop */ }
  }
  return true;
}
