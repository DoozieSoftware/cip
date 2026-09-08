import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../../../auth/AuthContext';
import type { TextileCollectionListItem } from '../../api/textileApi';
import type * as TextileShared from './shared';
import TextileReviewPage from './TextileReviewPage';
import { useDesk, useTextileQueue } from './shared';
import * as textileApi from '../../api/textileApi';

vi.mock('./shared', async () => {
  const actual = await vi.importActual<typeof TextileShared>('./shared');

  return {
    ...actual,
    SearchBox: () => null,
    ZoneFilter: () => null,
    MethodFilter: () => null,
    CategoryFilter: () => null,
    Pager: () => null,
    useDesk: vi.fn(),
    useTextileQueue: vi.fn(),
  };
});

vi.mock('../../api/textileApi', async () => {
  const actual = await vi.importActual<typeof textileApi>('../../api/textileApi');
  return {
    ...actual,
    approveTextileCollection: vi.fn().mockResolvedValue({ status: 'success' }),
  };
});

const ZONE = {
  id: 'zone-1',
  code: 'JAYANAGAR',
  name: 'Jayanagar',
  dropoff_name: null,
  dropoff_address: null,
};

function makeItem(overrides: Partial<TextileCollectionListItem>): TextileCollectionListItem {
  return {
    id: 'collection-1',
    reference: 'DLN-2026-79FFFC75',
    title: 'Textile pickup request',
    notes: null,
    status: 'pending_review',
    requester_type: 'individual',
    requester_name: 'Lakshmi Devi',
    rwa_name: null,
    contact_email: 'lakshmi@example.test',
    contact_phone: '+91 9876543210',
    pickup_address: '21, 11th Main, Jayanagar, Bengaluru 560041',
    collection_method: 'premises',
    estimated_bags: 3,
    estimated_weight_kg: 9,
    actual_bags: null,
    actual_weight_kg: null,
    scheduled_date: null,
    scheduled_window_start: null,
    scheduled_window_end: null,
    readiness_instructions: null,
    rejection_reason: null,
    missed_pickup_reason: null,
    picked_up_at: null,
    service_zone: ZONE,
    batch: null,
    submitted_at: '2026-08-26T10:00:00+05:30',
    photos: [],
    category: 'clothes_waste',
    partner: { id: 'partner-1', name: 'Dr. Linen' },
    ...overrides,
  };
}

const ITEM_1 = makeItem({
  id: 'col-1',
  reference: 'DLN-001',
  estimated_bags: 2,
  estimated_weight_kg: 6,
});
const ITEM_2 = makeItem({
  id: 'col-2',
  reference: 'DLN-002',
  requester_name: 'Rahul Sharma',
  contact_phone: '+91 9123456789',
  estimated_bags: 4,
  estimated_weight_kg: 12,
});

function renderReview() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/operations/textile-collections/review']}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Routes>
            <Route path="/operations/textile-collections/review" element={<TextileReviewPage />} />
          </Routes>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('TextileReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDesk).mockReturnValue({
      ready: true,
      isDrLinen: true,
      departmentId: 'department-1',
    });
    vi.mocked(useTextileQueue).mockReturnValue({
      data: {
        data: [ITEM_1, ITEM_2],
        meta: { page: 1, per_page: 25, total: 2, last_page: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTextileQueue>);
  });

  it('renders waiting count and high density row items with masked contact numbers', () => {
    renderReview();

    expect(screen.getByText('2 waiting')).toBeVisible();
    expect(screen.getByText('DLN-001')).toBeVisible();
    expect(screen.getByText('Lakshmi Devi')).toBeVisible();
    // Masked phone numbers prevent unneeded PII exposure
    expect(screen.getByText('•••• 3210')).toBeVisible();
    expect(screen.getByText('DLN-002')).toBeVisible();
    expect(screen.getByText('Rahul Sharma')).toBeVisible();
    expect(screen.getByText('•••• 6789')).toBeVisible();
  });

  it('shows floating bulk action dock when selecting rows and allows approving', async () => {
    renderReview();

    expect(screen.queryByRole('complementary', { name: 'Bulk actions' })).not.toBeInTheDocument();

    const selectAll = screen.getByRole('checkbox', { name: 'Select all on this page' });
    fireEvent.click(selectAll);

    const dock = screen.getByRole('complementary', { name: 'Bulk actions' });
    expect(dock).toBeVisible();
    expect(screen.getByText(/6 bags · ~18.0 kg/)).toBeVisible();

    const approveBtn = screen.getByRole('button', { name: /Approve \(2\)/ });
    fireEvent.click(approveBtn);

    // Dialog opens for confirmation
    const confirmDialog = screen.getByRole('dialog');
    expect(confirmDialog).toBeVisible();

    const confirmBtn = screen.getByRole('button', { name: 'Approve 2 requests' });
    fireEvent.click(confirmBtn);

    await vi.waitFor(() => {
      expect(textileApi.approveTextileCollection).toHaveBeenCalledWith('col-1', 'department-1');
      expect(textileApi.approveTextileCollection).toHaveBeenCalledWith('col-2', 'department-1');
    });
  });

  it('clears selection from floating dock', () => {
    renderReview();

    const select1 = screen.getByRole('checkbox', { name: 'Select DLN-001' });
    fireEvent.click(select1);

    expect(screen.getByRole('complementary', { name: 'Bulk actions' })).toBeVisible();

    const clearBtn = screen.getByRole('button', { name: 'Clear' });
    fireEvent.click(clearBtn);

    expect(screen.queryByRole('complementary', { name: 'Bulk actions' })).not.toBeInTheDocument();
  });
});
