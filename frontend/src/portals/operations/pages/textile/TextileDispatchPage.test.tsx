import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../../../auth/AuthContext';
import type { TextileCollectionListItem } from '../../api/textileApi';
import type * as TextileShared from './shared';
import TextileDispatchPage from './TextileDispatchPage';
import { useDesk, useTextileQueue } from './shared';

vi.mock('./shared', async () => {
  const actual = await vi.importActual<typeof TextileShared>('./shared');

  return {
    ...actual,
    SearchBox: () => null,
    ZoneFilter: () => null,
    CategoryFilter: () => null,
    Pager: () => null,
    useDesk: vi.fn(),
    useTextileQueue: vi.fn(),
  };
});

const ITEM: TextileCollectionListItem = {
  id: 'collection-1',
  reference: 'DLN-2026-79FFFC75',
  title: 'Bags and shoes',
  notes: null,
  status: 'scheduled',
  requester_type: 'individual',
  requester_name: 'Lakshmi Devi',
  rwa_name: null,
  contact_email: 'lakshmi@example.test',
  contact_phone: '+91 9876543210',
  pickup_address: '21, 11th Main, Jayanagar, Bengaluru 560041',
  collection_method: 'premises',
  estimated_bags: 4,
  estimated_weight_kg: 11,
  actual_bags: null,
  actual_weight_kg: null,
  scheduled_date: '2026-08-27',
  scheduled_window_start: null,
  scheduled_window_end: null,
  readiness_instructions: null,
  rejection_reason: null,
  missed_pickup_reason: null,
  picked_up_at: null,
  service_zone: null,
  batch: {
    id: 'batch-1',
    reference: 'DRL-260826-XX11TO',
    collection_date: '2026-08-27',
    status: 'scheduled',
  },
  submitted_at: '2026-08-26T10:00:00+05:30',
  photos: [],
  category: 'clothes_waste',
  partner: { id: 'partner-1', name: 'Dr. Linen' },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TextileDispatchPage />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('TextileDispatchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDesk).mockReturnValue({
      ready: true,
      isDrLinen: true,
      departmentId: 'department-1',
    });
    vi.mocked(useTextileQueue).mockReturnValue({
      data: {
        data: [ITEM],
        meta: { page: 1, per_page: 25, total: 1, last_page: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTextileQueue>);
  });

  it('does not expose a manual refresh action on the dispatch board', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
  });

  it('uses an accessible proof-photo button instead of exposing the raw file picker', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Record collection' }));

    const picker = screen.getByRole('button', { name: 'Choose proof photo' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    expect(picker).toBeVisible();
    expect(screen.getByText('JPG, PNG or WebP, up to 10 MB.')).toBeVisible();
    expect(fileInput).toHaveClass('sr-only');
    expect(fileInput).toHaveAttribute('tabindex', '-1');

    fireEvent.click(picker);

    expect(clickSpy).toHaveBeenCalledOnce();
    clickSpy.mockRestore();
  });
});
