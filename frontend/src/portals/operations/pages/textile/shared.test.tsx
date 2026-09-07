import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { OPERATIONS_QUEUE_REFRESH_MS, useTextileQueue } from './shared';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

const QUEUE_ARGS = {
  status: 'scheduled',
  search: '',
  page: 1,
  enabled: true,
  departmentId: 'department-1',
};

describe('useTextileQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes an active officer queue without a manual toolbar action', () => {
    renderHook(() => useTextileQueue({ ...QUEUE_ARGS, autoRefresh: true }));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        refetchInterval: OPERATIONS_QUEUE_REFRESH_MS,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      }),
    );
  });

  it('pauses updates while an officer has unfinished work', () => {
    renderHook(() => useTextileQueue({ ...QUEUE_ARGS, autoRefresh: false }));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        refetchInterval: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      }),
    );
  });
});
