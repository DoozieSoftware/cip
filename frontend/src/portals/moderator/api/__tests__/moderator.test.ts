import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * `QueueController::show/review/reject/escalate` all nest the report
 * under a `report` key (`respond(['report' => ...])`) on top of the
 * standard ApiResponse envelope. `queueApi.show` / `actionsApi.*`
 * must unwrap both levels so `ReportDetailPage` gets a flat
 * `ReportDetail` object.
 */
describe('queueApi / actionsApi — report-key unwrapping', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetModules();
  });

  function mockEnvelope(reportPayload: Record<string, unknown>): void {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          message: 'OK',
          data: { report: reportPayload },
          code: null,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
  }

  it('queueApi.show returns the flat report object', async () => {
    mockEnvelope({ id: 'r1', title: 'Pothole', mock_gps_score: 0.8 });

    const { queueApi } = await import('../moderator');
    const result = await queueApi.show('r1');

    expect(result.id).toBe('r1');
    expect(result.title).toBe('Pothole');
    expect(result.mock_gps_score).toBe(0.8);
  });

  it('actionsApi.review returns the flat report object', async () => {
    mockEnvelope({ id: 'r1', title: 'Pothole', status_code: 'assigned' });

    const { actionsApi } = await import('../moderator');
    const result = await actionsApi.review('r1', { decision: 'approve' } as never);

    expect(result.id).toBe('r1');
    expect(result.status_code).toBe('assigned');
  });
});
