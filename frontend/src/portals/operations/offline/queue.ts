/**
 * Operations offline queue — Phase 4 offline-safe field collection.
 *
 * Field workers capture proof photos when connectivity is poor.
 * This queue persists the whole `collect` payload (bags, weight,
 * photo blob, Idempotency-Key) in IndexedDB, ties it to the
 * authenticated user/session, and replays it safely when the
 * network returns.
 *
 * Security review notes (Phase 4 spec):
 *  - IndexedDB is origin-scoped; entries are partitioned by
 *    owner_id (authenticated user id) and never drained for
 *    another owner.
 *  - clear() is called on logout / session expiry so a device
 *    handover does not leak the previous worker's pending proof.
 *  - Server-side validation, checksum, authZ, audit and
 *    Idempotency-Key replay are never bypassed — retry re-hits
 *    the same POST /collect endpoint with the same key and the
 *    middleware guarantees one final outcome + one proof chain.
 */

export type OpsQueueItemKind = 'textile.collect' | 'textile.missed';

export type OpsQueueItemStatus = 'pending' | 'in_flight' | 'failed' | 'dead' | 'done';

export interface OpsQueueItem<TPayload = unknown> {
  id: string;
  owner_id: string;
  kind: OpsQueueItemKind;
  payload: TPayload;
  attempts: number;
  max_attempts: number;
  next_attempt_at: number;
  status: OpsQueueItemStatus;
  last_error?: string;
  enqueued_at: number;
  updated_at: number;
}

export interface OpsQueueAdapter {
  list(): Promise<OpsQueueItem[]>;
  put(item: OpsQueueItem): Promise<void>;
  delete(id: string): Promise<void>;
  patch(id: string, patch: Partial<OpsQueueItem>): Promise<void>;
}

export class MemoryOpsAdapter implements OpsQueueAdapter {
  private readonly store = new Map<string, OpsQueueItem>();
  list(): Promise<OpsQueueItem[]> {
    return Promise.resolve(Array.from(this.store.values()).sort((a, b) => a.enqueued_at - b.enqueued_at));
  }
  put(item: OpsQueueItem): Promise<void> {
    this.store.set(item.id, { ...item });
    return Promise.resolve();
  }
  delete(id: string): Promise<void> {
    this.store.delete(id);
    return Promise.resolve();
  }
  patch(id: string, patch: Partial<OpsQueueItem>): Promise<void> {
    const cur = this.store.get(id);
    if (!cur) return Promise.resolve();
    this.store.set(id, { ...cur, ...patch, updated_at: Date.now() });
    return Promise.resolve();
  }
}

let cachedIdbPromise: Promise<unknown> | null = null;
async function loadIdb(): Promise<unknown> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB not available');
  if (cachedIdbPromise) return cachedIdbPromise;
  cachedIdbPromise = (async () => {
    const mod: {
      openDB: (name: string, version: number, opts: { upgrade: (db: unknown) => void }) => Promise<unknown>;
    } = await import(/* @vite-ignore */ 'idb').catch(() => {
      throw new Error("The 'idb' package is not installed. Run `npm i idb`.");
    });
    return mod.openDB('cip-ops-queue', 1, {
      upgrade(database: unknown): void {
        type IDBObj = { createObjectStore: (name: string, opts: { keyPath: string }) => unknown };
        const store = (database as IDBObj).createObjectStore('ops_items', { keyPath: 'id' });
        type WithIndex = { createIndex: (name: string, key: string) => unknown };
        (store as WithIndex).createIndex('status', 'status');
        (store as WithIndex).createIndex('next_attempt_at', 'next_attempt_at');
      },
    });
  })();
  return cachedIdbPromise;
}

interface IdbStore { getAll(): Promise<OpsQueueItem[]>; get(key: string): Promise<OpsQueueItem | undefined>; put(v: unknown): Promise<void>; delete(k: string): Promise<void>; }
interface IdbTx { store: IdbStore; }
type Idb = { transaction: (s: string, m: string) => IdbTx; getAll: (s: string) => Promise<OpsQueueItem[]>; put: (s: string, v: unknown) => Promise<void>; delete: (s: string, k: string) => Promise<void>; };

export class IndexedDBOpsAdapter implements OpsQueueAdapter {
  private readonly dbPromise: Promise<Idb>;
  constructor() { this.dbPromise = loadIdb() as Promise<Idb>; }
  async list(): Promise<OpsQueueItem[]> { const db = await this.dbPromise; return db.getAll('ops_items'); }
  async put(item: OpsQueueItem): Promise<void> { const db = await this.dbPromise; await db.put('ops_items', item); }
  async delete(id: string): Promise<void> { const db = await this.dbPromise; await db.delete('ops_items', id); }
  async patch(id: string, patch: Partial<OpsQueueItem>): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('ops_items', 'readwrite');
    const cur = await tx.store.get(id);
    if (!cur) return;
    await tx.store.put({ ...cur, ...patch, updated_at: Date.now() });
  }
}

export interface OpsQueueOptions {
  adapter?: OpsQueueAdapter;
  owner_id?: string | null;
  max_attempts?: number;
  backoff?: (attempt: number) => number;
  now?: () => number;
  retry?: (item: OpsQueueItem) => Promise<void>;
}
export interface EnqueueOpsInput<TPayload> { kind: OpsQueueItemKind; payload: TPayload; id?: string; }

const DEFAULT_BACKOFF = (attempt: number): number => {
  const base = Math.min(2 ** attempt * 1000, 5 * 60 * 1000);
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
};
export const ANONYMOUS_OPS_OWNER = '__anonymous__';
const DONE_RETENTION_MS = 24 * 60 * 60 * 1000;
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'ops-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
}

export class OpsOfflineQueue {
  private readonly adapter: OpsQueueAdapter;
  private readonly maxAttempts: number;
  private readonly backoff: (attempt: number) => number;
  private readonly now: () => number;
  private readonly ownerId: string;
  private retry?: (item: OpsQueueItem) => Promise<void>;
  private running = false;
  private stopped = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Array<() => void> = [];

  constructor(opts: OpsQueueOptions = {}) {
    this.adapter = opts.adapter ?? new MemoryOpsAdapter();
    this.maxAttempts = opts.max_attempts ?? 5;
    this.backoff = opts.backoff ?? DEFAULT_BACKOFF;
    this.now = opts.now ?? (() => Date.now());
    this.ownerId = opts.owner_id || ANONYMOUS_OPS_OWNER;
    this.retry = opts.retry;
  }

  setRetryHandler(retry: (item: OpsQueueItem) => Promise<void>): void { this.retry = retry; }
  get owner_id(): string { return this.ownerId; }
  stop(): void { this.stopped = true; if (this.retryTimer !== null) clearTimeout(this.retryTimer); this.retryTimer = null; }
  resume(): void { this.stopped = false; }
  private owned(items: OpsQueueItem[]): OpsQueueItem[] { return items.filter((i) => i.owner_id === this.ownerId); }

  async size(): Promise<number> {
    const items = this.owned(await this.adapter.list());
    return items.filter((i) => i.status !== 'done').length;
  }
  async pending(): Promise<OpsQueueItem[]> {
    const items = this.owned(await this.adapter.list());
    return items.filter((i) => i.status === 'pending' || i.status === 'in_flight' || i.status === 'failed');
  }
  async failed(): Promise<OpsQueueItem[]> { return (await this.pending()).filter((i) => i.status === 'failed'); }
  async dead(): Promise<OpsQueueItem[]> {
    const items = this.owned(await this.adapter.list());
    return items.filter((i) => i.status === 'dead');
  }
  async all(): Promise<OpsQueueItem[]> { return this.owned(await this.adapter.list()); }

  async enqueue<TPayload>(input: EnqueueOpsInput<TPayload>): Promise<OpsQueueItem<TPayload>> {
    const id = input.id ?? uuid();
    const existing = (await this.adapter.list()).find((i) => i.id === id);
    if (existing && existing.owner_id !== this.ownerId) throw new Error('Queue item belongs to another account.');
    if (existing) return existing as OpsQueueItem<TPayload>;
    const item: OpsQueueItem<TPayload> = {
      id,
      owner_id: this.ownerId,
      kind: input.kind,
      payload: input.payload,
      attempts: 0,
      max_attempts: this.maxAttempts,
      next_attempt_at: this.now(),
      status: 'pending',
      enqueued_at: this.now(),
      updated_at: this.now(),
    };
    await this.adapter.put(item);
    this.emit();
    return item;
  }

  async remove(id: string): Promise<void> {
    const item = (await this.adapter.list()).find((c) => c.id === id);
    if (item?.owner_id !== this.ownerId) return;
    await this.adapter.delete(id);
    this.emit();
  }

  async clear(): Promise<void> {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const items = this.owned(await this.adapter.list());
    await Promise.all(items.map((i) => this.adapter.delete(i.id)));
    this.emit();
  }

  async cleanupDone(retentionMs = DONE_RETENTION_MS): Promise<number> {
    const cutoff = this.now() - retentionMs;
    const items = this.owned(await this.adapter.list());
    const done = items.filter((i) => i.status === 'done' && i.updated_at <= cutoff);
    await Promise.all(done.map((i) => this.adapter.delete(i.id)));
    if (done.length > 0) this.emit();
    return done.length;
  }

  async processOne(item: OpsQueueItem): Promise<OpsQueueItem> {
    if (item.owner_id !== this.ownerId) throw new Error('Queue item belongs to another account.');
    await this.adapter.patch(item.id, { status: 'in_flight', updated_at: this.now() });
    if (!this.retry) {
      await this.adapter.patch(item.id, { status: 'pending', updated_at: this.now() });
      return { ...item, status: 'pending' };
    }
    try {
      await this.retry(item);
      await this.adapter.patch(item.id, { status: 'done', updated_at: this.now() });
      return { ...item, status: 'done' };
    } catch (err) {
      const attempts = item.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      // Auth / validation failures must surface as dead immediately
      // so the worker can fix them — no silent discard.
      const isUnrecoverable =
        /401|FORBIDDEN|UNAUTHORIZED|VALIDATION_FAILED|PROOF_PHOTO_REQUIRED/i.test(message);
      if (isUnrecoverable) {
        await this.adapter.patch(item.id, { status: 'dead', attempts, last_error: message, updated_at: this.now() });
        return { ...item, status: 'dead', attempts, last_error: message };
      }
      if (attempts >= item.max_attempts) {
        await this.adapter.patch(item.id, { status: 'dead', attempts, last_error: message, updated_at: this.now() });
        return { ...item, status: 'dead', attempts, last_error: message };
      }
      const nextAttempt = this.now() + this.backoff(attempts);
      await this.adapter.patch(item.id, { status: 'failed', attempts, last_error: message, next_attempt_at: nextAttempt, updated_at: this.now() });
      return { ...item, status: 'failed', attempts, last_error: message, next_attempt_at: nextAttempt };
    }
  }

  async drain(): Promise<{ processed: number; succeeded: number; failed: number; dead: number }> {
    if (this.running || this.stopped) return { processed: 0, succeeded: 0, failed: 0, dead: 0 };
    this.running = true;
    let processed = 0, succeeded = 0, failed = 0, dead = 0;
    try {
      const items = this.owned(await this.adapter.list());
      const now = this.now();
      const due = items.filter((i) => (i.status === 'pending' || i.status === 'failed') && i.next_attempt_at <= now);
      for (const item of due) {
        const result = await this.processOne(item);
        processed++;
        if (result.status === 'done') succeeded++;
        else if (result.status === 'dead') dead++;
        else failed++;
      }
      await this.cleanupDone();
      this.scheduleNextDrain();
    } finally {
      this.running = false;
    }
    this.emit();
    return { processed, succeeded, failed, dead };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }
  private emit(): void { for (const l of this.listeners) l(); }

  private scheduleNextDrain(): void {
    if (this.stopped || this.retryTimer !== null) return;
    void this.adapter.list().then((all) => {
      if (this.stopped || this.retryTimer !== null) return;
      const now = this.now();
      const next = this.owned(all).filter((i) => (i.status === 'pending' || i.status === 'failed') && i.next_attempt_at > now).sort((a, b) => a.next_attempt_at - b.next_attempt_at)[0];
      if (!next) return;
      const delay = Math.max(250, Math.min(next.next_attempt_at - now, 5 * 60 * 1000));
      this.retryTimer = setTimeout(() => { this.retryTimer = null; void this.drain(); }, delay);
    });
  }
}

let _singleton: OpsOfflineQueue | null = null;
let _singletonOwner: string | null = null;

export function getOpsQueue(ownerIdOrAdapter?: string | null | OpsQueueAdapter, adapterArg?: OpsQueueAdapter): OpsOfflineQueue {
  const adapter = ownerIdOrAdapter !== null && typeof ownerIdOrAdapter === 'object' ? ownerIdOrAdapter : adapterArg;
  const owner = (typeof ownerIdOrAdapter === 'string' ? ownerIdOrAdapter : null) || ANONYMOUS_OPS_OWNER;
  if (!_singleton || _singletonOwner !== owner) {
    _singleton?.stop();
    let a: OpsQueueAdapter;
    if (adapter) a = adapter;
    else if (typeof indexedDB !== 'undefined') a = new IndexedDBOpsAdapter();
    else a = new MemoryOpsAdapter();
    _singleton = new OpsOfflineQueue({ adapter: a, owner_id: owner });
    _singletonOwner = owner;
  }
  return _singleton;
}

export function resetOpsQueue(): void { _singleton?.stop(); _singleton = null; _singletonOwner = null; }
export async function stopAndClearOpsQueue(ownerId: string): Promise<void> {
  const queue = getOpsQueue(ownerId);
  queue.stop();
  await queue.clear();
}
