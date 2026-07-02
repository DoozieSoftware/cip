/**
 * Citizen PWA offline queue (T-M13-006 + T-M13-007).
 *
 * Citizens can submit reports when their device is offline.
 * The form data and media blobs are persisted in IndexedDB,
 * and a background task replays the queue when the network
 * comes back. The service worker caches GETs and the SPA
 * queue handles mutations.
 *
 * Implementation choices:
 *  - Pure in-memory + (mock) IndexedDB adapter for testability.
 *    In production the adapter uses the `idb` library
 *    (`npm i idb`) — the public API of this module is
 *    adapter-agnostic.
 *  - Exponential backoff with jitter: 1s, 2s, 4s, 8s, 16s,
 *    capped at 5 minutes. After 5 attempts the item is
 *    flagged `dead` and surfaces in the UI for the user to
 *    edit or delete.
 *  - Dedup by client-generated UUID. If two submissions
 *    share an id (e.g. retry after a flaky network) the
 *    second is a no-op.
 *  - Each entry stores a JSON-serializable body plus an
 *    optional list of media blob refs (consumed separately
 *    by the upload pipeline).
 */

export type QueueItemKind = 'report.create' | 'report.media.upload';

export type QueueItemStatus = 'pending' | 'in_flight' | 'failed' | 'dead' | 'done';

export interface QueueItem<TPayload = unknown> {
  id: string;
  kind: QueueItemKind;
  payload: TPayload;
  attempts: number;
  max_attempts: number;
  next_attempt_at: number; // epoch ms
  status: QueueItemStatus;
  last_error?: string;
  enqueued_at: number;
  updated_at: number;
}

export interface QueueAdapter {
  list(): Promise<QueueItem[]>;
  put(item: QueueItem): Promise<void>;
  delete(id: string): Promise<void>;
  patch(id: string, patch: Partial<QueueItem>): Promise<void>;
}

/* ------------------------------------------------------------------ *
 * In-memory adapter (used when IndexedDB is unavailable, and in
 * tests). The contract is the same as the IndexedDB adapter.
 * ------------------------------------------------------------------ */
export class MemoryAdapter implements QueueAdapter {
  private readonly store = new Map<string, QueueItem>();

  async list(): Promise<QueueItem[]> {
    return Array.from(this.store.values()).sort((a, b) => a.enqueued_at - b.enqueued_at);
  }

  async put(item: QueueItem): Promise<void> {
    this.store.set(item.id, { ...item });
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async patch(id: string, patch: Partial<QueueItem>): Promise<void> {
    const cur = this.store.get(id);
    if (!cur) return;
    this.store.set(id, { ...cur, ...patch, updated_at: Date.now() });
  }
}

/* ------------------------------------------------------------------ *
 * IndexedDB adapter (used in the browser). The `idb` library is
 * lazy-loaded so tests and the SSR path don't need a polyfill.
 * ------------------------------------------------------------------ */

/**
 * IndexedDB adapter — wired in production when the
 * platform installs the `idb` peer dep. The adapter
 * auto-detects: if `idb` is not importable, methods
 * throw a clear error and the SPA falls back to the
 * MemoryAdapter (used in tests + SSR).
 */
let cachedIdbPromise: Promise<unknown> | null = null;

async function loadIdb(): Promise<unknown> {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB not available in this environment.');
  }
  if (cachedIdbPromise) return cachedIdbPromise;
  // `idb` is a peer dep; the platform installs it
  // (`npm i idb`). The dynamic import is wrapped in a
  // try/catch so the bundle still works without it.
  cachedIdbPromise = (async () => {
    const mod: {
      openDB: (
        name: string,
        version: number,
        opts: { upgrade: (db: unknown) => void },
      ) => Promise<unknown>;
    } = await import(/* @vite-ignore */ 'idb').catch(() => {
      throw new Error("The 'idb' package is not installed. Run `npm i idb` to enable the IndexedDB adapter.");
    });
    return mod.openDB('cip-citizen-queue', 1, {
      upgrade(database: unknown): void {
        type IDBObj = { createObjectStore: (name: string, opts: { keyPath: string }) => unknown };
        const obj = (database as IDBObj).createObjectStore('items', { keyPath: 'id' });
        type WithIndex = { createIndex: (name: string, key: string) => unknown };
        (obj as WithIndex).createIndex('status', 'status');
        (obj as WithIndex).createIndex('next_attempt_at', 'next_attempt_at');
      },
    });
  })();
  return cachedIdbPromise;
}

interface IdbStore {
  getAll(): Promise<QueueItem[]>;
  get(key: string): Promise<QueueItem | undefined>;
  put(value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}
interface IdbTx {
  store: IdbStore;
}
type Idb = {
  transaction: (store: string, mode: string) => IdbTx;
  getAll: (store: string) => Promise<QueueItem[]>;
  put: (store: string, value: unknown) => Promise<void>;
  delete: (store: string, key: string) => Promise<void>;
};

export class IndexedDBAdapter implements QueueAdapter {
  private readonly dbPromise: Promise<Idb>;

  constructor() {
    this.dbPromise = loadIdb() as Promise<Idb>;
  }

  async list(): Promise<QueueItem[]> {
    const db = await this.dbPromise;
    return db.getAll('items');
  }
  async put(item: QueueItem): Promise<void> {
    const db = await this.dbPromise;
    await db.put('items', item);
  }
  async delete(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('items', id);
  }
  async patch(id: string, patch: Partial<QueueItem>): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('items', 'readwrite');
    const cur = await tx.store.get(id);
    if (!cur) return;
    await tx.store.put({ ...cur, ...patch, updated_at: Date.now() });
  }
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export interface QueueOptions {
  adapter?: QueueAdapter;
  max_attempts?: number;
  backoff?: (attempt: number) => number;
  now?: () => number;
  retry?: (item: QueueItem) => Promise<void>;
}

export interface EnqueueInput<TPayload> {
  kind: QueueItemKind;
  payload: TPayload;
  id?: string;
}

const DEFAULT_BACKOFF = (attempt: number): number => {
  const base = Math.min(2 ** attempt * 1000, 5 * 60 * 1000);
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
};

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'q-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
}

export class OfflineQueue {
  private readonly adapter: QueueAdapter;
  private readonly maxAttempts: number;
  private readonly backoff: (attempt: number) => number;
  private readonly now: () => number;
  private retry?: (item: QueueItem) => Promise<void>;
  private running = false;
  private listeners: Array<() => void> = [];

  constructor(opts: QueueOptions = {}) {
    this.adapter = opts.adapter ?? new MemoryAdapter();
    this.maxAttempts = opts.max_attempts ?? 5;
    this.backoff = opts.backoff ?? DEFAULT_BACKOFF;
    this.now = opts.now ?? (() => Date.now());
    this.retry = opts.retry;
  }

  /**
   * Configure (or replace) the delivery function after construction —
   * used by the app shell to wire the singleton returned by
   * `getQueue()` to the real submit-report flow once, at startup,
   * without needing to thread it through the constructor call site.
   */
  setRetryHandler(retry: (item: QueueItem) => Promise<void>): void {
    this.retry = retry;
  }

  /** Total items, regardless of status. */
  async size(): Promise<number> {
    const items = await this.adapter.list();
    return items.length;
  }

  /** Items still in flight (pending, in_flight, failed-with-retries-left). */
  async pending(): Promise<QueueItem[]> {
    const items = await this.adapter.list();
    return items.filter((i) => i.status === 'pending' || i.status === 'in_flight' || i.status === 'failed');
  }

  /** Add a payload. Idempotent on `id`. */
  async enqueue<TPayload>(input: EnqueueInput<TPayload>): Promise<QueueItem<TPayload>> {
    const id = input.id ?? uuid();
    const existing = (await this.adapter.list()).find((i) => i.id === id);
    if (existing) return existing as QueueItem<TPayload>;
    const item: QueueItem<TPayload> = {
      id,
      kind: input.kind,
      payload: input.payload,
      attempts: 0,
      max_attempts: this.maxAttempts,
      next_attempt_at: this.now(),
      status: 'pending',
      enqueued_at: this.now(),
      updated_at: this.now(),
    };
    await this.adapter.put(item as QueueItem);
    this.emit();
    return item;
  }

  async remove(id: string): Promise<void> {
    await this.adapter.delete(id);
    this.emit();
  }

  async clear(): Promise<void> {
    const items = await this.adapter.list();
    await Promise.all(items.map((i) => this.adapter.delete(i.id)));
    this.emit();
  }

  /**
   * Mark an item as `in_flight` and try to deliver it via `retry`.
   * If `retry` throws, increment `attempts`, compute backoff, and
   * re-schedule — or flip to `dead` once `max_attempts` is reached.
   */
  async processOne(item: QueueItem): Promise<QueueItem> {
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
      if (attempts >= item.max_attempts) {
        await this.adapter.patch(item.id, { status: 'dead', attempts, last_error: message, updated_at: this.now() });
        return { ...item, status: 'dead', attempts, last_error: message };
      }
      const nextAttempt = this.now() + this.backoff(attempts);
      await this.adapter.patch(item.id, { status: 'failed', attempts, last_error: message, next_attempt_at: nextAttempt, updated_at: this.now() });
      return { ...item, status: 'failed', attempts, last_error: message, next_attempt_at: nextAttempt };
    }
  }

  /**
   * Drain the queue, processing items whose `next_attempt_at` has
   * elapsed. Returns when no further items are due. Safe to call
   * repeatedly; concurrent calls are no-ops.
   */
  async drain(): Promise<{ processed: number; succeeded: number; failed: number; dead: number }> {
    if (this.running) return { processed: 0, succeeded: 0, failed: 0, dead: 0 };
    this.running = true;
    let processed = 0, succeeded = 0, failed = 0, dead = 0;
    try {
      const items = await this.adapter.list();
      const now = this.now();
      const due = items.filter((i) => (i.status === 'pending' || i.status === 'failed') && i.next_attempt_at <= now);
      for (const item of due) {
        const result = await this.processOne(item);
        processed++;
        if (result.status === 'done') succeeded++;
        else if (result.status === 'dead') dead++;
        else failed++;
      }
    } finally {
      this.running = false;
    }
    this.emit();
    return { processed, succeeded, failed, dead };
  }

  /** Subscribe to changes. Returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

/* ------------------------------------------------------------------ *
 * Browser singleton — survives HMR but not page reloads (the
 * adapter keeps the data).
 * ------------------------------------------------------------------ */

let _singleton: OfflineQueue | null = null;

export function getQueue(adapter?: QueueAdapter): OfflineQueue {
  if (!_singleton) {
    let a: QueueAdapter;
    if (adapter) {
      a = adapter;
    } else if (typeof indexedDB !== 'undefined') {
      a = new IndexedDBAdapter();
    } else {
      a = new MemoryAdapter();
    }
    _singleton = new OfflineQueue({ adapter: a });
  }
  return _singleton;
}

export function resetQueue(): void {
  _singleton = null;
}
