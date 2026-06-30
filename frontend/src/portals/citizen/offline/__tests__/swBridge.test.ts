import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { requestBackgroundSync } from '../swBridge';

type Listener = (event: MessageEvent) => void;


function makeSw() {
  const listeners: Listener[] = [];
  const postMessage = vi.fn();
  // Both the "registration" (what `ready` resolves to) and the
  // outer "serviceWorker" surface share the same listener list
  // and the same postMessage mock.
  const registration = { active: { postMessage } };
  const sw = {
    ready: Promise.resolve(registration),
    controller: registration.active,
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
    removeEventListener: (_: string, fn: Listener) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    __listeners: listeners,
    __post: postMessage,
  };
  // @ts-expect-error — stub the SW surface for the bridge
  globalThis.navigator = { serviceWorker: sw };
  return sw as unknown as {
    ready: Promise<{ active: { postMessage: ReturnType<typeof vi.fn> } }>;
    controller: { postMessage: ReturnType<typeof vi.fn> } | null;
    addEventListener: (t: string, fn: Listener) => void;
    removeEventListener: (t: string, fn: Listener) => void;
    __listeners: Listener[];
    __post: ReturnType<typeof vi.fn>;
  };
}

describe('swBridge (T-M13-007)', () => {
  let sw: ReturnType<typeof makeSw>;

  beforeEach(() => {
    sw = makeSw();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requestBackgroundSync posts a queue:request-sync message to the active SW', async () => {
    const r = await requestBackgroundSync();
    expect(r.registered).toBe(true);
    expect(sw.__post).toHaveBeenCalledWith({ type: 'queue:request-sync' });
  });

  it('onQueueDrain invokes the handler when the SW posts queue:drain', async () => {
    const { onQueueDrain } = await import('../swBridge');
    const handler = vi.fn();
    onQueueDrain(handler);
    const ev = { data: { type: 'queue:drain' } } as MessageEvent;
    sw.__listeners.forEach((l) => l(ev));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('onQueueDrain ignores other message types', async () => {
    const { onQueueDrain } = await import('../swBridge');
    const handler = vi.fn();
    onQueueDrain(handler);
    const ev = { data: { type: 'push:received' } } as MessageEvent;
    sw.__listeners.forEach((l) => l(ev));
    expect(handler).not.toHaveBeenCalled();
  });

  it('onPushReceived surfaces the payload to subscribers', async () => {
    const { onPushReceived } = await import('../swBridge');
    const handler = vi.fn();
    onPushReceived(handler);
    const ev = { data: { type: 'push:received', payload: { title: 't', body: 'b', url: '/u', tag: 'x' } } } as MessageEvent;
    sw.__listeners.forEach((l) => l(ev));
    expect(handler).toHaveBeenCalledWith({ title: 't', body: 'b', url: '/u', tag: 'x' });
  });

  it('onPushNavigate fires for push:navigate with a url', async () => {
    const { onPushNavigate } = await import('../swBridge');
    const handler = vi.fn();
    onPushNavigate(handler);
    const ev = { data: { type: 'push:navigate', url: '/citizen/notifications' } } as MessageEvent;
    sw.__listeners.forEach((l) => l(ev));
    expect(handler).toHaveBeenCalledWith('/citizen/notifications');
  });

  it('unsubscribe removes the listener', async () => {
    const { onQueueDrain } = await import('../swBridge');
    const handler = vi.fn();
    const off = onQueueDrain(handler);
    off();
    const ev = { data: { type: 'queue:drain' } } as MessageEvent;
    sw.__listeners.forEach((l) => l(ev));
    expect(handler).not.toHaveBeenCalled();
  });
});
