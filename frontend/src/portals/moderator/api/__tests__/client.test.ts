import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Regression coverage for a real bug found while wiring mock_gps_score
 * into the moderator fraud panel: `request()` used to return the raw
 * `ApiResponse` envelope (`{success, message, data, ...}`) cast as if
 * it were the payload itself, so every caller's `result.someField` was
 * actually `envelope.someField` — always `undefined`. This affected
 * every moderator page that reads report data (queue, detail,
 * review/reject/escalate). There was no test at all for this client
 * before this fix.
 */
describe('moderator api client — ApiResponse envelope unwrapping', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('unwraps the ApiResponse envelope so callers see the real payload, not the envelope', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          message: 'OK',
          data: { title: 'Pothole on MG Road', mock_gps_score: 0.42 },
          errors: null,
          code: null,
          trace_id: 't-1',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const { api } = await import('../client');
    const result = await api.get<{ title: string; mock_gps_score: number }>('/moderator/reports/abc');

    expect(result.title).toBe('Pothole on MG Road');
    expect(result.mock_gps_score).toBe(0.42);
    // The bug's signature: the envelope itself has no `title` key.
    expect((result as unknown as Record<string, unknown>)['success']).toBeUndefined();
  });

  it('still throws ApiError on a non-ok response, using the envelope message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, message: 'Report not found', data: null, code: 'NOT_FOUND' }),
        { status: 404, headers: { 'content-type': 'application/json' } },
      ),
    );

    const { api, ApiError } = await import('../client');

    await expect(api.get('/moderator/reports/missing')).rejects.toBeInstanceOf(ApiError);
  });
});
