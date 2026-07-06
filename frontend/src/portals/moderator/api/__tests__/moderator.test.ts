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

  it('queueApi.list normalizes cursor items into paginated queue data', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          message: 'OK',
          data: {
            items: [
              {
                id: 'r1',
                tracking_number: 'CIV-2026-000001',
                title: 'Pothole',
                ai_confidence: 92,
                fraud_score: 10,
                duplicate_score: 5,
                mock_gps_score: 0.2,
                submitted_at: '2026-07-06T10:00:00Z',
                report_type: { id: 't1', code: 'pothole', name: 'Pothole' },
                status: { code: 'pending_moderator' },
              },
            ],
            next_cursor: null,
            prev_cursor: null,
          },
          code: null,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const { queueApi } = await import('../moderator');
    const result = await queueApi.list();

    expect(result.data).toHaveLength(1);
    expect(result.data[0].category?.name).toBe('Pothole');
    expect(result.data[0].status_code).toBe('pending_moderator');
    expect(result.meta.total).toBe(1);
  });
});
