import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pushSupport, subscribeToPush } from '../subscribe';

const originalNotification = globalThis.Notification;
const originalPushManager = globalThis.PushManager;
const originalNavigator = globalThis.navigator;
const originalFetch = globalThis.fetch;

/** Mirror of the module's private converter, for asserting key bytes. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Perm = 'default' | 'granted' | 'denied';

function installStubs(
  opts: {
    permission?: Perm;
    requestResult?: Perm;
    subscribeRejects?: boolean;
    subscribeResult?: Record<string, unknown>;
  } = {},
): {
  pushSubscribe: ReturnType<typeof vi.fn>;
  requestPermission: ReturnType<typeof vi.fn>;
  serviceWorkerRegister: ReturnType<typeof vi.fn>;
} {
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
  const serviceWorkerRegister = vi.fn().mockResolvedValue(registration);
  // Spread the original navigator so platform properties (userAgent, vendor,
  // platform…) survive stubbing. Leaflet evaluates Browser.js from
  // `navigator.userAgent` at module load; a bare stub without userAgent
  // crashes any Leaflet-importing test file that runs later in the same
  // Vitest fork ("Cannot read properties of undefined (reading
  // 'toLowerCase')" in leaflet/src/core/Browser.js).
  globalThis.navigator = {
    ...(originalNavigator as unknown as Record<string, unknown>),
    serviceWorker: {
      ready: Promise.resolve(registration),
      getRegistration: () => Promise.resolve(registration),
      register: serviceWorkerRegister,
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

  return { pushSubscribe, requestPermission, serviceWorkerRegister };
}

describe('subscribeToPush (BUG #5)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
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

  it('registers the service worker on demand when page-load registration is missing', async () => {
    const { pushSubscribe, serviceWorkerRegister } = installStubs({});
    const serviceWorker = globalThis.navigator.serviceWorker;
    vi.spyOn(serviceWorker, 'getRegistration').mockResolvedValue(undefined);

    const res = await subscribeToPush({
      applicationServerKey: 'abcdefghijklmnopqrstuvwxyzABCDEFGH',
    });

    expect(res.ok).toBe(true);
    expect(serviceWorkerRegister).toHaveBeenCalledWith('/sw.js?dev=1');
    expect(pushSubscribe).toHaveBeenCalledTimes(1);
  });

  it('prefers the backend-provided key over the build-time env fallback', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'env-fallback-key-value');
    const { pushSubscribe } = installStubs({});

    const res = await subscribeToPush();

    expect(res.ok).toBe(true);
    const callArg = pushSubscribe.mock.calls[0][0] as { applicationServerKey?: BufferSource };
    expect(new Uint8Array(callArg.applicationServerKey as ArrayBuffer)).toEqual(
      urlBase64ToUint8Array('abcdefghijklmnopqrstuvwxyzABCDEFGH'),
    );
  });

  it('falls back to the build-time env key when the backend endpoint fails', async () => {
    const envKey = 'abcdefghijklmnopqrstuvwxyzABCDEFGH';
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', envKey);
    const { pushSubscribe } = installStubs({});
    // Vapid endpoint errors; every other request (the persist POST) succeeds.
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('vapid-public-key')) {
        return Promise.resolve(new Response('server error', { status: 500 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: null }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });

    const res = await subscribeToPush();

    expect(res.ok).toBe(true);
    const callArg = pushSubscribe.mock.calls[0][0] as { applicationServerKey?: BufferSource };
    expect(new Uint8Array(callArg.applicationServerKey as ArrayBuffer)).toEqual(
      urlBase64ToUint8Array(envKey),
    );
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

  it('persists the current aes128gcm content encoding when the browser omits it', async () => {
    installStubs({ subscribeResult: { endpoint: 'https://push.example/sub', keys: {} } });

    await subscribeToPush({ applicationServerKey: 'abcdefghijklmnopqrstuvwxyzABCDEFGH' });

    const fetchMock = vi.mocked(globalThis.fetch);
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeDefined();
    const rawBody = postCall?.[1]?.body;
    expect(typeof rawBody).toBe('string');
    if (typeof rawBody !== 'string') throw new Error('Expected a JSON request body.');
    const body = JSON.parse(rawBody) as { content_encoding?: string };
    expect(body.content_encoding).toBe('aes128gcm');
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
