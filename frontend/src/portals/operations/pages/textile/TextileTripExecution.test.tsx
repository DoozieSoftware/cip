import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TextileDispatchPage from './TextileDispatchPage';
import { useDesk, useTextileQueue } from './shared';
import type { TextileCollectionListItem } from '../../api/textileApi';
import type * as sharedModule from './shared';

vi.mock('./shared', async () => {
  const actual = await vi.importActual<typeof sharedModule>('./shared');
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
  title: 'Bags',
  notes: null,
  status: 'scheduled',
  requester_type: 'individual',
  requester_name: 'Lakshmi',
  rwa_name: null,
  contact_email: 'a@test',
  contact_phone: '+91 9876543210',
  pickup_address: '21 Jayanagar',
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
  partner: { id: 'p1', name: 'Dr. Linen' },
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <TextileDispatchPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('Textile trip execution frontend (Phase 2, unblocked subset)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDesk).mockReturnValue({
      ready: true,
      isDrLinen: true,
      departmentId: 'department-1',
    });
    vi.mocked(useTextileQueue).mockReturnValue({
      data: { data: [ITEM], meta: { page: 1, per_page: 25, total: 1, last_page: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTextileQueue>);
  });

  it('FE-C1 board defers outcome submits to the stop-work page (single navigation target)', () => {
    // Board rows are pure navigation now; the collect/missed POSTs live on the stop page.
    renderPage();
    const links = screen.getAllByRole('link', { name: /Pickup 1: Lakshmi/ });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toContain('/collections/batch-1/stops/collection-1');
    expect(screen.queryByRole('button', { name: 'Record collection' })).not.toBeInTheDocument();
  });

  it('FE-C1 proof capture lives on the stop page (board keeps no file picker)', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /Pickup 1: Lakshmi/ }).getAttribute('href')).toContain(
      '/collections/batch-1/stops/collection-1',
    );
    expect(screen.queryByRole('button', { name: 'Choose proof photo' })).not.toBeInTheDocument();
  });

  it.todo('FE-X1 citizen cancel confirm dialog + disabled after picked_up/cancelled/rejected');
});
