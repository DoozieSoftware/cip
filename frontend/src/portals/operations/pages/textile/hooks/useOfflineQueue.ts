import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearCompletedOfflineItems,
  dataUrlToFile,
  enqueueOfflineCollection,
  loadOfflineQueue,
  removeOfflineItem,
  saveOfflineQueue,
  updateOfflineItem,
  type OfflineQueuedCollection,
} from '../../../api/offlineQueue';
import {
  recordTextileOutcome,
  reportOfflineFailure,
  uploadTextileProofPhoto,
} from '../../../api/textileApi';
import { ApiError } from '../../../../../shared/api/errors';

export interface OfflineQueueHook {
  items: OfflineQueuedCollection[];
  pendingCount: number;
  failedCount: number;
  isOnline: boolean;
  isRetrying: boolean;
  enqueue: (args: {
    collectionId: string;
    reference: string;
    bags: number;
    weight: number;
    file: File;
    idempotencyKey?: string;
  }) => Promise<OfflineQueuedCollection>;
  retryAll: () => Promise<void>;
  retryOne: (key: string) => Promise<void>;
  remove: (key: string) => void;
  clearCompleted: () => void;
  reportFailure: (key: string, reason: string) => Promise<void>;
}

export function useOfflineQueue(userId: string | undefined, departmentId: string | undefined): OfflineQueueHook {
  const [items, setItems] = useState<OfflineQueuedCollection[]>(() =>
    userId ? loadOfflineQueue(userId) : [],
  );
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [isRetrying, setIsRetrying] = useState(false);

  const reload = useCallback(() => {
    if (!userId) {
      setItems([]);
      return;
    }
    setItems(loadOfflineQueue(userId));
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onStorage = (e: StorageEvent) => {
      if (userId && e.key === `cip_offline_queue:${userId}`) reload();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('storage', onStorage);
    };
  }, [reload, userId]);

  // Keep document-local state in sync with localStorage mutations made via helpers.
  useEffect(() => {
    const id = window.setInterval(reload, 1000);
    return () => window.clearInterval(id);
  }, [reload]);

  const pendingCount = useMemo(() => items.filter((i) => i.status === 'pending' || i.status === 'uploading').length, [items]);
  const failedCount = useMemo(() => items.filter((i) => i.status === 'failed').length, [items]);

  const enqueue = useCallback(
    async (args: {
      collectionId: string;
      reference: string;
      bags: number;
      weight: number;
      file: File;
      idempotencyKey?: string;
    }) => {
      if (!userId) throw new Error('No user session');
      const { fileToDataUrl, newIdempotencyKey } = await import('../../../api/offlineQueue');
      const dataUrl = await fileToDataUrl(args.file);
      const key = args.idempotencyKey ?? newIdempotencyKey();
      const entry = enqueueOfflineCollection(userId, {
        idempotencyKey: key,
        collectionId: args.collectionId,
        collectionReference: args.reference,
        bags: args.bags,
        weight: args.weight,
        fileDataUrl: dataUrl,
        fileName: args.file.name,
        fileType: args.file.type,
        fileSize: args.file.size,
      });
      reload();
      return entry;
    },
    [reload, userId],
  );

  const doRetryOne = useCallback(
    async (key: string) => {
      if (!userId) return;
      const queue = loadOfflineQueue(userId);
      const item = queue.find((i) => i.idempotencyKey === key);
      if (!item) return;

      // Corrupted data URL -> mark failed, do not silently discard
      const file = dataUrlToFile(item.fileDataUrl, item.fileName, item.fileType);
      if (!file) {
        updateOfflineItem(userId, key, { status: 'failed', lastError: 'Corrupted upload data — please re-capture proof photo.' });
        reload();
        return;
      }

      // Validate before upload (size/type) — if invalid, fail with clear reason
      const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
      if (!ALLOWED.includes(file.type) || file.size > 10 * 1024 * 1024) {
        updateOfflineItem(userId, key, {
          status: 'failed',
          lastError: 'Proof photo failed validation (type/size). Please re-capture.',
        });
        reload();
        return;
      }

      updateOfflineItem(userId, key, { status: 'uploading', attempts: item.attempts + 1 });
      reload();

      try {
        await uploadTextileProofPhoto(item.collectionId, file, departmentId, undefined, item.idempotencyKey);
        await recordTextileOutcome(item.collectionId, {
          outcome: 'collected',
          actual_bags: item.bags,
          actual_weight_kg: item.weight,
          department_id: departmentId,
          idempotencyKey: item.idempotencyKey,
        });
        updateOfflineItem(userId, key, { status: 'completed' });
        // Retention: clear completed after confirmed upload (keep until cleared by hook/policy)
        // We mark completed but do not delete immediately so UI can show success; caller clears.
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? `${e.code}: ${e.message}`
            : e instanceof Error
              ? e.message
              : 'Upload failed';
        // Session expired -> failed with guidance, not pending
        const isAuth = e instanceof ApiError && e.status === 401;
        updateOfflineItem(userId, key, {
          status: 'failed',
          lastError: isAuth ? `Session expired — please log in again and retry. (${msg})` : msg,
        });
      } finally {
        reload();
      }
    },
    [departmentId, reload, userId],
  );

  const retryAll = useCallback(async () => {
    if (!userId || isRetrying) return;
    setIsRetrying(true);
    const queue = loadOfflineQueue(userId);
    const pending = queue.filter((i) => i.status === 'pending' || i.status === 'failed');
    for (const item of pending) {
      // Reset failed to pending for retry attempt
      if (item.status === 'failed') {
        updateOfflineItem(userId, item.idempotencyKey, { status: 'pending' });
      }
      await doRetryOne(item.idempotencyKey);
      // Small delay between retries to avoid flooding
      await new Promise((r) => setTimeout(r, 300));
    }
    setIsRetrying(false);
    reload();
  }, [doRetryOne, isRetrying, reload, userId]);

  // Auto-retry when coming back online
  useEffect(() => {
    if (isOnline && userId) {
      const q = loadOfflineQueue(userId);
      if (q.some((i) => i.status === 'pending')) {
        void retryAll();
      }
    }
  }, [isOnline, retryAll, userId]);

  const remove = useCallback(
    (key: string) => {
      if (!userId) return;
      removeOfflineItem(userId, key);
      reload();
    },
    [reload, userId],
  );

  const clearCompleted = useCallback(() => {
    if (!userId) return;
    clearCompletedOfflineItems(userId);
    // Also prune completed from state
    const q = loadOfflineQueue(userId);
    saveOfflineQueue(
      userId,
      q.filter((i) => i.status !== 'completed'),
    );
    reload();
  }, [reload, userId]);

  const reportFailure = useCallback(
    async (key: string, reason: string) => {
      if (!userId) return;
      const q = loadOfflineQueue(userId);
      const item = q.find((i) => i.idempotencyKey === key);
      if (!item) return;
      try {
        await reportOfflineFailure(item.collectionId, {
          idempotency_key: item.idempotencyKey,
          failure_reason: reason,
          payload_snapshot: { bags: item.bags, weight: item.weight, reference: item.collectionReference },
          department_id: departmentId,
        });
      } catch {
        // Non-fatal — recovery view still shows local failed item
      }
    },
    [departmentId, userId],
  );

  return { items, pendingCount, failedCount, isOnline, isRetrying, enqueue, retryAll, retryOne: doRetryOne, remove, clearCompleted, reportFailure };
}
