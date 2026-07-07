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
  reason?: 'unsupported' | 'permission_denied' | 'subscription_failed' | 'persist_failed';
  subscription?: PushSubscriptionJSON;
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

  const reg = await navigator.serviceWorker.ready;
  let sub: PushSubscription;
  try {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: opts.applicationServerKey
        ? (urlBase64ToUint8Array(opts.applicationServerKey) as unknown as BufferSource)
        : undefined,
    });
  } catch {
    // No VAPID key supplied, unsupported by the browser, or the
    // user revoked permission mid-flow. Return a typed result so the
    // caller can show a toast instead of crashing on an unhandled rejection.
    return { ok: false, reason: 'subscription_failed' };
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
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch {
    return false;
  }

  const endpoint = opts.endpoint ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(PUSH_STORAGE_KEY) : null);
  if (endpoint) {
    try {
      await apiRequest<unknown>(opts.subscribeUrl ?? `/notifications/push/subscriptions/${encodeURIComponent(endpoint)}`, {
        method: 'DELETE',
      });
    } catch {
      // best-effort
    }
    try { localStorage.removeItem(PUSH_STORAGE_KEY); } catch { /* noop */ }
  }
  return true;
}
