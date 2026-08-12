import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  accessToken: 'expired-token',
  setTokens: vi.fn((nextAccessToken: string) => {
    auth.accessToken = nextAccessToken;
  }),
  logout: vi.fn(),
}));

vi.mock('../../auth/storage', () => ({
  getToken: () => auth.accessToken,
  getRefreshToken: () => 'refresh-token',
  setTokens: auth.setTokens,
  handleUnauthorized: auth.logout,
}));

import { request, requestRaw } from './client';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('shared API client', () => {
  beforeEach(() => {
    auth.accessToken = 'expired-token';
    auth.setTokens.mockClear();
    auth.logout.mockClear();
    vi.restoreAllMocks();
  });

  it('unwraps data for migrated consumers and preserves envelopes for compatibility callers', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'report-1' } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: ['row'], meta: { total: 1 } }));

    await expect(request<{ id: string }>('/reports/report-1')).resolves.toEqual({
      id: 'report-1',
    });
    await expect(
      requestRaw<{ success: boolean; data: string[]; meta: { total: number } }>('/reports'),
    ).resolves.toEqual({ success: true, data: ['row'], meta: { total: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a 401 once with the newly refreshed access token', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthenticated' }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            token: { access_token: 'fresh-token' },
            refresh_token: 'rotated-refresh-token',
            refresh_expires_at: '2026-09-01T00:00:00Z',
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'report-1' } }));

    await expect(request<{ id: string }>('/reports/report-1')).resolves.toEqual({
      id: 'report-1',
    });

    expect(auth.setTokens).toHaveBeenCalledWith(
      'fresh-token',
      'rotated-refresh-token',
      '2026-09-01T00:00:00Z',
    );
    const retryOptions = fetchMock.mock.calls[2]?.[1];
    expect(retryOptions?.headers).toMatchObject({ Authorization: 'Bearer fresh-token' });
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
