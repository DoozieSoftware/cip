import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { request } from '../../../shared/api/client';
import { useRescheduleTextileCollection } from './textileZones';

vi.mock('../../../shared/api/client', () => ({ request: vi.fn(), upload: vi.fn() }));

describe('useRescheduleTextileCollection', () => {
  it('sends Laravel schedule fields and invalidates the detail and list after success', async () => {
    vi.mocked(request).mockResolvedValue({ id: 'col-1' });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRescheduleTextileCollection('col-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        requested_date: '2026-10-15',
        window_start: '14:00',
        window_end: '17:00',
        reason: 'Available in the afternoon',
      });
    });

    expect(request).toHaveBeenCalledExactlyOnceWith(
      '/citizen/textile-collections/col-1/reschedule',
      {
        method: 'POST',
        body: {
          scheduled_date: '2026-10-15',
          scheduled_window_start: '14:00',
          scheduled_window_end: '17:00',
          reason: 'Available in the afternoon',
        },
      },
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['citizen', 'textile-collections', 'col-1'],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['citizen', 'textile-collections'] });
    client.clear();
  });
});
