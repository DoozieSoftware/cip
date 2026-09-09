import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../../../auth/AuthContext';
import type { TextileCollectionListItem } from '../../api/textileApi';
import type * as TextileApi from '../../api/textileApi';
import { fetchCapacityRules } from '../../api/textileApi';
import type * as TextileShared from './shared';
import TextileTripNewPage from './TextileTripNewPage';
import { useDesk, useTextileQueue } from './shared';

vi.mock('./shared', async () => {
  const actual = await vi.importActual<typeof TextileShared>('./shared');

  return {
    ...actual,
    useDesk: vi.fn(),
    useTextileQueue: vi.fn(),
  };
});

vi.mock('../../api/textileApi', async () => {
  const actual = await vi.importActual<typeof TextileApi>('../../api/textileApi');
  return {
    ...actual,
    fetchCapacityRules: vi.fn(() => Promise.resolve([])),
    scheduleTextileBatch: vi.fn(() => Promise.resolve({ id: 'batch-1' })),
    assignTextileTrip: vi.fn(() => Promise.resolve({ id: 'batch-1' })),
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
    title: 'Bags and shoes',
    notes: null,
    status: 'ready_to_group',
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

const READY_ITEM = makeItem({});
const MISSED_ITEM = makeItem({
  id: 'collection-2',
  reference: 'DLN-2026-81AAAB12',
  requester_name: 'Ravi Kumar',
  pickup_address: '42, 9th Cross, Jayanagar, Bengaluru 560041',
  status: 'missed',
  missed_pickup_reason: 'Nobody answered the door',
  scheduled_date: '2026-09-01',
  scheduled_window_start: '09:00',
  scheduled_window_end: '12:00',
});

function renderNewTrip(state?: unknown) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter
      initialEntries={[
        { pathname: '/operations/textile-collections/schedule/new', state: state ?? null },
      ]}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Routes>
            <Route
              path="/operations/textile-collections/schedule/new"
              element={<TextileTripNewPage />}
            />
            <Route
              path="/operations/textile-collections/schedule"
              element={<div>Trips page</div>}
            />
          </Routes>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('TextileTripNewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDesk).mockReturnValue({
      ready: true,
      isDrLinen: true,
      departmentId: 'department-1',
    });
    vi.mocked(useTextileQueue).mockReturnValue({
      data: {
        data: [READY_ITEM, MISSED_ITEM],
        meta: { page: 1, per_page: 200, total: 2, last_page: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTextileQueue>);
  });

  it('shows an empty state linking back to Trips when opened without a selection', () => {
    renderNewTrip();

    expect(screen.getByText('No requests selected')).toBeVisible();
    const backLink = screen.getByRole('link', { name: 'Back to Trips' });
    expect(backLink).toHaveAttribute('href', '/operations/textile-collections/schedule');
    expect(screen.queryByRole('button', { name: 'Schedule trip' })).not.toBeInTheDocument();
  });

  it('confirms the collections carried over from Trips and allows removal', () => {
    renderNewTrip({ selectedIds: ['collection-1', 'collection-2'] });

    expect(screen.getByText('DLN-2026-79FFFC75')).toBeVisible();
    expect(screen.getByText('DLN-2026-81AAAB12')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Remove DLN-2026-81AAAB12' }));

    expect(screen.queryByText('DLN-2026-81AAAB12')).not.toBeInTheDocument();
    expect(screen.getByText('DLN-2026-79FFFC75')).toBeVisible();
  });

  it('fills both time fields from a preset chip and keeps 24h values', () => {
    renderNewTrip({ selectedIds: ['collection-1'] });

    fireEvent.click(screen.getByRole('button', { name: '09:00–12:00' }));

    expect(screen.getByLabelText('Start time')).toHaveValue('09:00');
    expect(screen.getByLabelText('End time')).toHaveValue('12:00');
    // All three presets stay available; manual inputs remain for custom override.
    expect(screen.getByRole('button', { name: '12:00–15:00' })).toBeVisible();
    expect(screen.getByRole('button', { name: '15:00–18:00' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '10:30' } });
    expect(screen.getByLabelText('Start time')).toHaveValue('10:30');
  });

  it('keeps scheduling validation working for a mixed ready + missed selection', () => {
    renderNewTrip({ selectedIds: ['collection-1', 'collection-2'] });

    const scheduleButton = screen.getByRole('button', { name: 'Schedule trip' });
    // No date yet — still blocked.
    expect(scheduleButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Pickup date', { selector: 'input' }), {
      target: { value: '2026-09-20' },
    });

    expect(scheduleButton).toBeEnabled();
    expect(vi.mocked(fetchCapacityRules)).toHaveBeenCalled();
  });

  it('returns to Trips keeping the remaining selection', () => {
    renderNewTrip({ selectedIds: ['collection-1', 'collection-2'] });

    fireEvent.click(screen.getByRole('button', { name: 'Remove DLN-2026-81AAAB12' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to Trips' }));

    expect(screen.getByText('Trips page')).toBeVisible();
  });
});
