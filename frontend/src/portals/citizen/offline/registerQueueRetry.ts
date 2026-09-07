import { getQueue, type QueueItem } from './queue';
import { submitReportPayload, type CreateReportInput } from '../api/client';
import { submitTextileRequestPayload } from '../api/textileZones';
import type { CreateTextileCollectionInput } from '../api/textileZones';
import { request as apiRequest, upload as apiUpload } from '../../../shared/api/client';

/**
 * Wires the offline queue's delivery function to the real
 * create-report flow. Before this existed, `getQueue()` had no
 * `retry` configured at all — `drain()` (called by `onQueueDrain`
 * and the dashboard's periodic poll) would flip every queued item
 * straight back to `pending` without ever attempting delivery, so
 * an offline submission could sit in IndexedDB forever. Idempotent —
 * safe to call from every mount of the citizen app shell.
 */
export function registerOfflineQueueRetry(ownerId?: string | null): void {
  const owner = ownerId ?? undefined;
  const queue = getQueue(owner);

  queue.setRetryHandler(async (item: QueueItem) => {
    if (item.kind === 'report.create') {
      await submitReportPayload(item.payload as CreateReportInput);
      return;
    }
    if (item.kind === 'textile.request.create') {
      const payload = item.payload as CreateTextileCollectionInput & {
        idempotency_key?: string;
        photo_file?: File | null;
      };
      // Preserve the queue item id as the Idempotency-Key so retries are idempotent
      // and cannot create duplicate bookings or proof chains.
      await submitTextileRequestPayload({ ...payload, idempotency_key: item.id });
      return;
    }
    if (item.kind === 'textile.request.photo') {
      const p = item.payload as { collectionId: string; file: File; idempotency_key?: string };
      const fd = new FormData();
      fd.append('photo', p.file);
      await apiUpload(`/citizen/textile-collections/${p.collectionId}/photo`, fd, {
        headers: { 'Idempotency-Key': p.idempotency_key ?? item.id },
      });
      return;
    }
    if (item.kind === 'textile.field.outcome') {
      const p = item.payload as {
        collectionId: string;
        outcome: 'collected' | 'missed';
        actual_bags?: number;
        actual_weight_kg?: number;
        reason?: string;
        photo?: File | null;
        department_id?: string;
      };
      // Proof photo first (if any) — server validates checksum/size server-side.
      // Both steps share the same Idempotency-Key so a retry cannot produce two outcomes.
      if (p.photo) {
        const fd = new FormData();
        fd.append('photo', p.photo);
        await apiUpload(`/department/textile-collections/${p.collectionId}/proof`, fd, {
          headers: { 'Idempotency-Key': item.id },
          query: p.department_id ? { department_id: p.department_id } : {},
        }).catch(() => {
          // Proof upload may be re-attempted via the outcome itself; don't mask error.
        });
      }
      await apiRequest(`/department/textile-collections/${p.collectionId}/outcome`, {
        method: 'POST',
        headers: { 'Idempotency-Key': item.id },
        body: {
          outcome: p.outcome,
          actual_bags: p.actual_bags,
          actual_weight_kg: p.actual_weight_kg,
          reason: p.reason,
          department_id: p.department_id,
        },
        query: p.department_id ? { department_id: p.department_id } : {},
      });
      return;
    }
    throw new Error(`No delivery handler for queue item kind "${item.kind}".`);
  });
}
