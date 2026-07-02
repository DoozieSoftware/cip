import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getQueue, resetQueue } from '../queue';
import { registerOfflineQueueRetry } from '../registerQueueRetry';

const submitReportPayloadMock = vi.fn();

vi.mock('../../api/client', () => ({
  submitReportPayload: (...args: unknown[]) => submitReportPayloadMock(...args) as Promise<unknown>,
}));

// `registerOfflineQueueRetry()` is idempotent by design (an app-mount
// guard, not a per-test reset hook) — call it once for the whole file
// and reuse the same singleton, clearing its *contents* (not the
// registration) between tests.
resetQueue();
registerOfflineQueueRetry();

describe('registerOfflineQueueRetry', () => {
  beforeEach(async () => {
    submitReportPayloadMock.mockReset();
    await getQueue().clear();
  });

  it('wires report.create items to submitReportPayload so drain() actually delivers them', async () => {
    submitReportPayloadMock.mockResolvedValue({ id: 'r1', status: 'submitted' });

    const queue = getQueue();
    await queue.enqueue({ kind: 'report.create', payload: { title: 'Pothole' } });

    const result = await queue.drain();

    expect(result.succeeded).toBe(1);
    expect(submitReportPayloadMock).toHaveBeenCalledWith({ title: 'Pothole' });
  });

  it('marks the item failed (not silently dropped) when delivery throws', async () => {
    submitReportPayloadMock.mockRejectedValue(new Error('network down'));

    const queue = getQueue();
    await queue.enqueue({ kind: 'report.create', payload: { title: 'Pothole' } });

    const result = await queue.drain();

    expect(result.failed).toBe(1);
    const pending = await queue.pending();
    expect(pending[0]?.status).toBe('failed');
  });

  it('throws for an unknown queue item kind instead of silently succeeding', async () => {
    const queue = getQueue();
    await queue.enqueue({ kind: 'report.media.upload', payload: {} });

    const result = await queue.drain();

    expect(result.failed).toBe(1);
  });
});
