import { getQueue, type QueueItem } from './queue';
import { submitReportPayload, type CreateReportInput } from '../api/client';

let registered = false;

/**
 * Wires the offline queue's delivery function to the real
 * create-report flow. Before this existed, `getQueue()` had no
 * `retry` configured at all — `drain()` (called by `onQueueDrain`
 * and the dashboard's periodic poll) would flip every queued item
 * straight back to `pending` without ever attempting delivery, so
 * an offline submission could sit in IndexedDB forever. Idempotent —
 * safe to call from every mount of the citizen app shell.
 */
export function registerOfflineQueueRetry(): void {
  if (registered) return;
  registered = true;

  getQueue().setRetryHandler(async (item: QueueItem) => {
    if (item.kind === 'report.create') {
      await submitReportPayload(item.payload as CreateReportInput);
      return;
    }
    throw new Error(`No delivery handler for queue item kind "${item.kind}".`);
  });
}
