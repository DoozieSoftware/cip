import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pushSupport, subscribeToPush } from '../subscribe';

const originalNotification = globalThis.Notification;
const originalPushManager = globalThis.PushManager;
const originalNavigator = globalThis.navigator;
const originalFetch = globalThis.fetch;

type Perm = 'default' | 'granted' | 'denied';

function installStubs(
  opts: {
    permission?: Perm;
    requestResult?: Perm;
    subscribeRejects?: boolean;
    subscribeResult?: Record<string, unknown>;
  } = {},
): { pushSubscribe: ReturnType<typeof vi.fn>; requestPermission: ReturnType<typeof vi.fn> } {
  const permission = opts.permission ?? 'granted';
  const requestResult = opts.requestResult ?? 'granted';

  const pushSubscribe = vi.fn().mockImplementation(() => {
    if (opts.subscribeRejects) return Promise.reject(new Error('push failed'));
    return Promise.resolve({
      toJSON: () => opts.subscribeResult ?? { endpoint: 'https://push.example/sub', keys: {} },
      unsubscribe: () => Promise.resolve(true),
    });
  });

  const vapidPublicKey = 'abcdefghijklmnopqrstuvwxyzABCDEFGH';

  const requestPermission = vi.fn().mockResolvedValue(requestResult);

  // @ts-expect-error — stub notification surface
  globalThis.Notification = {
    permission,
    requestPermission,
  };

  // pushSupport() checks `'PushManager' in window`.
  // @ts-expect-error — stub window feature
  globalThis.PushManager = class {};

  const registration = {
    pushManager: { subscribe: pushSubscribe, getSubscription: () => Promise.resolve(null) },
  } as unknown as ServiceWorkerRegistration;
  globalThis.navigator = {
    serviceWorker: {
      ready: Promise.resolve(registration),
      getRegistration: () => Promise.resolve(registration),
    },
  } as unknown as Navigator;

  // Silent API persist (default success). Provide a real Response so
  // apiRequest() can read headers / json without throwing.
  globalThis.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: { public_key: vapidPublicKey } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );

  return { pushSubscribe, requestPermission };
}

describe('subscribeToPush (BUG #5)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore jsdom's browser globals so this serial Vitest pool does not
    // leak an incomplete environment into unrelated suites (Leaflet, for
    // example, reads navigator.userAgent during module evaluation).
    globalThis.Notification = originalNotification;
    globalThis.PushManager = originalPushManager;
    globalThis.navigator = originalNavigator;
    globalThis.fetch = originalFetch;
  });

  it('(a) fetches the configured VAPID key when none is supplied', async () => {
    const { pushSubscribe } = installStubs({ subscribeResult: { endpoint: 'e', keys: {} } });

    const res = await subscribeToPush();

    expect(pushSubscribe).toHaveBeenCalledTimes(1);
    const callArg = pushSubscribe.mock.calls[0][0] as { applicationServerKey?: BufferSource };
    expect(callArg.applicationServerKey).toBeDefined();
    expect(res.ok).toBe(true);
  });

  it('treats a partial Notification shim without permission as unsupported', () => {
    installStubs();
    // @ts-expect-error — intentionally incomplete browser shim
    globalThis.Notification = {};

    expect(pushSupport()).toEqual({ supported: false, permission: null });
  });

  it('passes the configured applicationServerKey through to pushManager.subscribe', async () => {
    const { pushSubscribe } = installStubs({ subscribeResult: { endpoint: 'e', keys: {} } });

    await subscribeToPush({ applicationServerKey: 'abcdefghijklmnopqrstuvwxyzABCDEFGH' });

    const callArg = pushSubscribe.mock.calls[0][0] as { applicationServerKey?: BufferSource };
    expect(callArg.applicationServerKey).toBeDefined();
  });

  it('returns { ok:false, reason:"permission_denied" } when permission is denied', async () => {
    const { pushSubscribe } = installStubs({ permission: 'denied' });

    const res = await subscribeToPush();

    expect(pushSubscribe).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: false, reason: 'permission_denied' });
  });

  it('returns { ok:false, reason:"permission_denied" } when the user dismisses the prompt', async () => {
    const { pushSubscribe } = installStubs({ permission: 'default', requestResult: 'denied' });

    const res = await subscribeToPush();

    expect(pushSubscribe).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: false, reason: 'permission_denied' });
  });

  it('returns { ok:false, reason:"subscription_failed" } instead of throwing when subscribe rejects', async () => {
    const { pushSubscribe } = installStubs({ subscribeRejects: true });

    const res = await subscribeToPush({ applicationServerKey: 'some-key' });

    expect(pushSubscribe).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ ok: false, reason: 'subscription_failed' });
  });
});
