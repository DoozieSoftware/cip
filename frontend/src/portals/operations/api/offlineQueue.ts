/**
 * Phase 4 — Offline-safe field collection queue.
 *
 * Device-local storage tied to authenticated user/session.
 * Pending items are cleared after confirmed upload per retention policy.
 * Retry is idempotent via Idempotency-Key; proof is re-validated server-side.
 *
 * Security: queue is scoped to userId (tied to session). On logout, caller
 * must clear the queue. Corrupted uploads are not silently discarded — they
 * become failed items visible in the recovery view.
 */

export type OfflineQueueStatus = 'pending' | 'uploading' | 'failed' | 'completed';

export interface OfflineQueuedCollection {
  /** Idempotency-Key — UUID v4, survives retries. */
  idempotencyKey: string;
  collectionId: string;
  collectionReference: string;
  bags: number;
  weight: number;
  /** Base64 data URL or raw base64 + mime */
  fileDataUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  reason?: string;
  createdAt: string;
  attempts: number;
  status: OfflineQueueStatus;
  lastError?: string;
  /** User who queued it — for device/user-scoped clearing */
  queuedBy: string;
}

const STORAGE_PREFIX = 'cip_offline_queue:';

export function offlineQueueKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadOfflineQueue(userId: string): OfflineQueuedCollection[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(offlineQueueKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineQueuedCollection[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(userId: string, items: OfflineQueuedCollection[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(offlineQueueKey(userId), JSON.stringify(items));
}

export function enqueueOfflineCollection(
  userId: string,
  item: Omit<OfflineQueuedCollection, 'attempts' | 'status' | 'createdAt' | 'queuedBy'>,
): OfflineQueuedCollection {
  const queue = loadOfflineQueue(userId);
  const entry: OfflineQueuedCollection = {
    ...item,
    attempts: 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
    queuedBy: userId,
  };
  queue.push(entry);
  saveOfflineQueue(userId, queue);
  return entry;
}

export function updateOfflineItem(
  userId: string,
  idempotencyKey: string,
  patch: Partial<OfflineQueuedCollection>,
): void {
  const queue = loadOfflineQueue(userId);
  const idx = queue.findIndex((i) => i.idempotencyKey === idempotencyKey);
  if (idx === -1) return;
  queue[idx] = { ...queue[idx], ...patch };
  saveOfflineQueue(userId, queue);
}

export function removeOfflineItem(userId: string, idempotencyKey: string): void {
  const queue = loadOfflineQueue(userId);
  saveOfflineQueue(
    userId,
    queue.filter((i) => i.idempotencyKey !== idempotencyKey),
  );
}

export function clearOfflineQueueForUser(userId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(offlineQueueKey(userId));
}

export function clearCompletedOfflineItems(userId: string): void {
  const queue = loadOfflineQueue(userId);
  saveOfflineQueue(
    userId,
    queue.filter((i) => i.status !== 'completed'),
  );
}

/** Convert a File to a data URL (base64) for localStorage. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/** Re-hydrate a data URL back to a File. Returns null if corrupted. */
export function dataUrlToFile(dataUrl: string, fileName: string, fileType: string): File | null {
  try {
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) return null;
    const base64 = match[2];
    const mime = match[1] ?? fileType;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], fileName, { type: mime });
  } catch {
    return null;
  }
}

/** Generate an idempotency key (UUID v4). */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
