import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TextileDispatchPage />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
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

  it('does not expose a manual refresh action on the collections board', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
  });

  it('renders stops as navigation rows into the dedicated stop-work page', () => {
    renderPage();

    const stopLink = screen.getByRole('link', { name: /Stop 1: Lakshmi Devi/ });
    expect(stopLink).toBeVisible();
    expect(stopLink.getAttribute('href')).toBe(
      '/operations/textile-collections/collections/batch-1/stops/collection-1',
    );
    // Stop-work actions live on the stop page, not inline on the board.
    expect(screen.queryByRole('button', { name: 'Mark missed' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record collection' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Call' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Navigate' })).not.toBeInTheDocument();
  });

  it('opens and closes the trip sheet modal for high-density route manifests', () => {
    renderPage();

    // Modal should be closed initially
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Open route details drawer first by clicking the route row
    fireEvent.click(screen.getByText('DRL-260826-XX11TO'));

    // Open Trip Sheet modal from drawer header
    const tripSheetBtn = screen.getByRole('button', { name: /Trip Sheet \(1\)/ });
    fireEvent.click(tripSheetBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Stops Manifest/)).toBeInTheDocument();
    expect(within(dialog).getByText(/DRL-260826-XX11TO/)).toBeInTheDocument();

    // Close via Done button
    const doneBtn = within(dialog).getByRole('button', { name: 'Done' });
    fireEvent.click(doneBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens and closes the slide-over route details drawer when opening a route', () => {
    renderPage();

    // Drawer is closed initially
    expect(
      screen.queryByRole('complementary', { name: 'Route details drawer' }),
    ).not.toBeInTheDocument();

    // Click route row to open drawer
    fireEvent.click(screen.getByText('DRL-260826-XX11TO'));

    // Drawer is now open with route title and itinerary
    expect(screen.getByRole('complementary', { name: 'Route details drawer' })).toBeInTheDocument();
    expect(screen.getByText(/Route DRL-260826-XX11TO/)).toBeInTheDocument();

    // Close via Done button
    const doneBtn = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(doneBtn);
    expect(
      screen.queryByRole('complementary', { name: 'Route details drawer' }),
    ).not.toBeInTheDocument();
  });

  it('labels the row action as Open route', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Open route' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inspect Route' })).not.toBeInTheDocument();
  });

  it('contains progress text with ellipsis instead of overlapping the next stop', () => {
    renderPage();

    const progress = screen.getByLabelText(/Trip progress/);
    const tooltip = progress.closest('div[title]');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.getAttribute('title')).toMatch(/collected/);
    expect(tooltip?.className).toMatch(/overflow-hidden/);
    expect(tooltip?.className).toMatch(/whitespace-nowrap/);

    const progressCell = tooltip?.closest('td');
    expect(progressCell?.className).toMatch(/overflow-hidden/);
    expect(progressCell?.className).toMatch(/min-w-0/);

    const nextStopLink = screen.getByRole('link', { name: /Stop 1: Lakshmi Devi/ });
    const nextStopCell = nextStopLink.closest('td');
    expect(nextStopCell?.className).toMatch(/overflow-hidden/);
    expect(nextStopCell?.className).toMatch(/min-w-0/);
  });

  it('renders a 10-stop route smoothly with Next Stop callout and stop links', () => {
    const tenStops: TextileCollectionListItem[] = Array.from({ length: 10 }, (_, i) => ({
      ...ITEM,
      id: `collection-${i + 1}`,
      reference: `DLN-2026-STOP${i + 1}`,
      requester_name: `Customer ${i + 1}`,
      pickup_address: `${i + 10} Main St, Bengaluru 5600${i + 10}`,
      status: i === 0 ? 'picked_up' : 'scheduled',
    }));

    vi.mocked(useTextileQueue).mockReturnValue({
      data: {
        data: tenStops,
        meta: { page: 1, per_page: 25, total: 10, last_page: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTextileQueue>);

    renderPage();

    // Click route row to open drawer
    fireEvent.click(screen.getByText('DRL-260826-XX11TO'));

    // Route footer hint for 10 stops inside drawer
    expect(screen.getByText(/Showing itinerary \(10 stops\)/)).toBeInTheDocument();

    // Next stop banner inside drawer should highlight stop #2 (since stop #1 is picked_up)
    expect(screen.getByText(/Next Stop #2/)).toBeInTheDocument();

    // All stops exist in the DOM (table + drawer)
    const allLinks = screen.getAllByRole('link', { name: /Stop \d+: Customer/ });
    expect(allLinks.length).toBeGreaterThanOrEqual(10);
  });

  it('keeps trip counts on the board but hides them in the route drawer', () => {
    const fourStops: TextileCollectionListItem[] = Array.from({ length: 4 }, (_, i) => ({
      ...ITEM,
      id: `collection-${i + 1}`,
      reference: `DLN-2026-STOP${i + 1}`,
      requester_name: `Customer ${i + 1}`,
      pickup_address: `${i + 10} Main St, Bengaluru 5600${i + 10}`,
      status: i === 0 ? 'picked_up' : 'scheduled',
    }));

    vi.mocked(useTextileQueue).mockReturnValue({
      data: {
        data: fourStops,
        meta: { page: 1, per_page: 25, total: 4, last_page: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTextileQueue>);

    renderPage();

    // Board-level progress keeps the count text.
    expect(screen.getAllByText(/1 of 4/).length).toBeGreaterThanOrEqual(1);

    // Open the route details side panel.
    fireEvent.click(screen.getByText('DRL-260826-XX11TO'));
    const drawer = screen.getByRole('complementary', { name: 'Route details drawer' });
    expect(within(drawer).getByRole('progressbar')).toBeInTheDocument();
    expect(within(drawer).queryByText(/1 of 4 collected/)).not.toBeInTheDocument();
    expect(within(drawer).queryByText(/3 left/)).not.toBeInTheDocument();
    // Per-stop status chips stay glanceable inside the drawer.
    expect(within(drawer).getAllByText('Collected').length).toBeGreaterThanOrEqual(1);
  });
});
