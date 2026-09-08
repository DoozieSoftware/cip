import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../../../auth/AuthContext';
import type { TextileCollectionListItem } from '../../api/textileApi';
import type * as TextileShared from './shared';
import TextileSchedulePage from './TextileSchedulePage';
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

function renderSchedule(state?: unknown) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter
      initialEntries={[
        { pathname: '/operations/textile-collections/schedule', state: state ?? null },
      ]}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Routes>
            <Route
              path="/operations/textile-collections/schedule"
              element={<TextileSchedulePage />}
            />
            <Route
              path="/operations/textile-collections/schedule/new"
              element={<div>New trip page</div>}
            />
          </Routes>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('TextileSchedulePage', () => {
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
        meta: { page: 1, per_page: 25, total: 2, last_page: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTextileQueue>);
  });

  it('fetches ready and missed bookings so missed ones can be re-tripped', () => {
    renderSchedule();

    expect(vi.mocked(useTextileQueue)).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ready_to_group,missed' }),
    );
  });

  it('badges missed rows as missed with a re-attempt marker and reason', () => {
    renderSchedule();

    expect(screen.getByText('Missed')).toBeVisible();
    expect(screen.getByText('Re-attempt')).toBeVisible();
    expect(screen.getByText(/Previously missed: Nobody answered the door/)).toBeVisible();
    // Ready rows do not get the re-attempt marker.
    expect(screen.getAllByText('Re-attempt')).toHaveLength(1);
  });

  it('shows a sticky bar with counts that continues to the new-trip page', () => {
    renderSchedule();

    expect(screen.queryByRole('button', { name: /Schedule →/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select DLN-2026-79FFFC75' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select DLN-2026-81AAAB12' }));

    const scheduleButton = screen.getByRole('button', { name: /2 selected · 8 bags · Schedule →/ });
    expect(scheduleButton).toBeVisible();
    expect(scheduleButton).toBeEnabled();

    fireEvent.click(scheduleButton);
    expect(screen.getByText('New trip page')).toBeVisible();
  });

  it('restores the selection when returning from the new-trip page', () => {
    renderSchedule({ selectedIds: ['collection-1'] });

    expect(screen.getByRole('button', { name: /1 selected · 4 bags · Schedule →/ })).toBeVisible();
  });

  it('clears the selection from the sticky bar', () => {
    renderSchedule();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select DLN-2026-79FFFC75' }));
    expect(screen.getByRole('button', { name: /Schedule →/ })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByRole('button', { name: /Schedule →/ })).not.toBeInTheDocument();
  });

  it('allows collapsing and expanding zone sections to manage screen space', () => {
    renderSchedule();

    const collapseBtn = screen.getByRole('button', { name: 'Collapse Jayanagar' });
    expect(screen.getByText('DLN-2026-79FFFC75')).toBeVisible();

    fireEvent.click(collapseBtn);
    expect(screen.queryByText('DLN-2026-79FFFC75')).not.toBeInTheDocument();

    const expandBtn = screen.getByRole('button', { name: 'Expand Jayanagar' });
    fireEvent.click(expandBtn);
    expect(screen.getByText('DLN-2026-79FFFC75')).toBeVisible();
  });

  it('renders quick jump buttons and batch collapse when multiple zones exist', () => {
    const ZONE_2 = {
      id: 'zone-2',
      code: 'KORAMANGALA',
      name: 'Koramangala',
      dropoff_name: null,
      dropoff_address: null,
    };
    const ITEM_ZONE_2 = makeItem({
      id: 'collection-3',
      reference: 'DLN-2026-99999999',
      service_zone: ZONE_2,
    });

    vi.mocked(useTextileQueue).mockReturnValue({
      data: {
        data: [READY_ITEM, ITEM_ZONE_2],
        meta: { page: 1, per_page: 25, total: 2, last_page: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTextileQueue>);

    renderSchedule();

    expect(screen.getByRole('button', { name: /Jayanagar \(1\)/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Koramangala \(1\)/ })).toBeVisible();

    const collapseAll = screen.getByRole('button', { name: 'Collapse all zones' });
    fireEvent.click(collapseAll);

    expect(screen.queryByText('DLN-2026-79FFFC75')).not.toBeInTheDocument();
    expect(screen.queryByText('DLN-2026-99999999')).not.toBeInTheDocument();

    const expandAll = screen.getByRole('button', { name: 'Expand all zones' });
    fireEvent.click(expandAll);

    expect(screen.getByText('DLN-2026-79FFFC75')).toBeVisible();
    expect(screen.getByText('DLN-2026-99999999')).toBeVisible();
  });
});
