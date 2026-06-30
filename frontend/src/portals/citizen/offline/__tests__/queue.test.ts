import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfflineQueue, MemoryAdapter, type QueueItem } from '../queue';

function makeQueue(opts?: Partial<{ retry: (item: QueueItem) => Promise<void>; backoff: (a: number) => number; now: () => number; max_attempts: number }>): { q: OfflineQueue; calls: number; failures: number } {
  const calls = { count: 0, failures: 0 };
  const retry = opts?.retry ?? (async () => { calls.count++; });
  const backoff = opts?.backoff ?? (() => 1000);
  const now = opts?.now ?? (() => 1_000_000);
  const q = new OfflineQueue({ adapter: new MemoryAdapter(), retry, backoff, now, max_attempts: opts?.max_attempts ?? 3 });
  return { q, calls: calls.count as unknown as number, failures: calls.failures };
}

describe('OfflineQueue (T-M13-006 / T-M13-026)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enqueues a new item with pending status and a UUID id', async () => {
    const { q } = makeQueue();
    const item = await q.enqueue({ kind: 'report.create', payload: { title: 'pothole' } });
    expect(item.id).toMatch(/.+/);
    expect(item.status).toBe('pending');
    expect(item.attempts).toBe(0);
    expect(await q.size()).toBe(1);
  });

  it('is idempotent on id (dedupe)', async () => {
    const { q } = makeQueue();
    const id = 'fixed-1';
    const a = await q.enqueue({ id, kind: 'report.create', payload: { x: 1 } });
    const b = await q.enqueue({ id, kind: 'report.create', payload: { x: 1 } });
    expect(a.id).toBe(id);
    expect(b.id).toBe(id);
    expect(await q.size()).toBe(1);
  });

  it('processes a pending item successfully and marks it done', async () => {
    const retry = vi.fn(async () => undefined);
    const { q } = makeQueue({ retry });
    const item = await q.enqueue({ kind: 'report.create', payload: { ok: true } });
    const result = await q.processOne(item);
    expect(result.status).toBe('done');
    expect(retry).toHaveBeenCalledOnce();
  });

  it('increments attempts on failure and reschedules with backoff', async () => {
    let now = 1_000_000;
    const backoff = vi.fn((a: number) => 5_000 * a);
    const retry = vi.fn(async () => { throw new Error('network down'); });
    const q = new OfflineQueue({ adapter: new MemoryAdapter(), retry, backoff, now: () => now, max_attempts: 5 });
    const item = await q.enqueue({ kind: 'report.create', payload: {} });
    const result = await q.processOne(item);
    expect(result.status).toBe('failed');
    expect(result.attempts).toBe(1);
    expect(backoff).toHaveBeenCalledWith(1);
    expect(result.next_attempt_at).toBe(1_000_000 + 5_000);
  });

  it('moves an item to dead after max_attempts', async () => {
    const retry = vi.fn(async () => { throw new Error('persistent failure'); });
    const { q } = makeQueue({ retry, max_attempts: 2 });
    const item = await q.enqueue({ kind: 'report.create', payload: {} });
    const a = await q.processOne(item);
    expect(a.status).toBe('failed');
    const b = await q.processOne({ ...a, status: 'failed', attempts: 1 });
    expect(b.status).toBe('dead');
  });

  it('drain() picks up due items and skips items in the future', async () => {
    let now = 1_000_000;
    const retry = vi.fn(async () => undefined);
    const q = new OfflineQueue({ adapter: new MemoryAdapter(), retry, backoff: () => 0, now: () => now, max_attempts: 5 });
    await q.enqueue({ kind: 'report.create', payload: { a: 1 }, id: 'due-1' });
    await q.enqueue({ kind: 'report.create', payload: { a: 2 }, id: 'future-1' });
    // Force future-1's next_attempt_at into the future.
    const all = await q.pending();
    const futureItem = all.find((i) => i.id === 'future-1');
    if (futureItem) {
      futureItem.next_attempt_at = 2_000_000;
      await (q as unknown as { adapter: MemoryAdapter }).adapter.put(futureItem);
    }
    const result = await q.drain();
    expect(result.succeeded).toBe(1);
    expect(result.processed).toBe(1);
  });

  it('drain() counts succeeded / failed / dead correctly', async () => {
    const retry = vi.fn(async (item: QueueItem) => {
      if (item.payload === null) throw new Error('x');
    });
    const { q } = makeQueue({ retry, max_attempts: 1 });
    await q.enqueue({ kind: 'report.create', payload: null, id: 'will-die' });
    await q.enqueue({ kind: 'report.create', payload: 'ok', id: 'will-succeed' });
    const result = await q.drain();
    expect(result.succeeded).toBe(1);
    expect(result.dead).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('subscribe is invoked after enqueue and drain', async () => {
    const retry = vi.fn(async () => undefined);
    const { q } = makeQueue({ retry });
    const listener = vi.fn();
    const unsub = q.subscribe(listener);
    await q.enqueue({ kind: 'report.create', payload: {}, id: 's1' });
    expect(listener).toHaveBeenCalled();
    await q.drain();
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2);
    unsub();
  });

  it('remove() deletes the item and clear() empties the queue', async () => {
    const { q } = makeQueue();
    const item = await q.enqueue({ kind: 'report.create', payload: {}, id: 'rem' });
    await q.remove(item.id);
    expect(await q.size()).toBe(0);
    await q.enqueue({ kind: 'report.create', payload: {}, id: 'a' });
    await q.enqueue({ kind: 'report.create', payload: {}, id: 'b' });
    await q.clear();
    expect(await q.size()).toBe(0);
  });
});
