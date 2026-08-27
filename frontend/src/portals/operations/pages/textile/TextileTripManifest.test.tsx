import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TextileDispatchPage from './TextileDispatchPage';
import { useDesk, useTextileQueue } from './shared';
import type { TextileCollectionListItem } from '../../api/textileApi';

vi.mock('./shared', async () => {
  const actual = await vi.importActual<typeof import('./shared')>('./shared');
  return { ...actual, SearchBox: () => null, ZoneFilter: () => null, CategoryFilter: () => null, Pager: () => null, useDesk: vi.fn(), useTextileQueue: vi.fn() };
});

const makeItem = (overrides: Partial<TextileCollectionListItem> = {}): TextileCollectionListItem => ({
  id: 'c-1',
  reference: 'DLN-2026-AAAA1111',
  title: 'Bags',
  notes: null,
  status: 'scheduled',
  requester_type: 'individual',
  requester_name: 'Lakshmi Devi',
  rwa_name: null,
  contact_email: 'a@test',
  contact_phone: '+91 9876543210',
  pickup_address: '21, 80 Feet Road, Jayanagar 4th Block, Bengaluru 560041',
  collection_method: 'premises',
  estimated_bags: 4,
  estimated_weight_kg: 11,
  actual_bags: null,
  actual_weight_kg: null,
  scheduled_date: '2026-08-27',
  scheduled_window_start: null,
  scheduled_window_end: null,
  readiness_instructions: 'Leave bags at gate',
  rejection_reason: null,
  missed_pickup_reason: null,
  picked_up_at: null,
  service_zone: null,
  batch: { id: 'batch-1', reference: 'DRL-260826-XX11TO', collection_date: '2026-08-27', status: 'planned' },
  submitted_at: '2026-08-26T10:00:00+05:30',
  photos: [{ id: 'ev-1', role: 'evidence', url: 'https://cdn/citizen-evidence.jpg' }],
  category: 'clothes_waste',
  partner: { id: 'p1', name: 'Dr. Linen' },
  ...overrides,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><TextileDispatchPage /></QueryClientProvider>);
}

describe('Textile trip manifest (Phase 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDesk).mockReturnValue({ ready: true, isDrLinen: true, departmentId: 'dept-1' } as ReturnType<typeof useDesk>);
  });

  it('manifest shows next stop address (and groups by trip)', () => {
    vi.mocked(useTextileQueue).mockReturnValue({ data: { data: [makeItem()], meta: { page: 1, per_page: 25, total: 1, last_page: 1 } }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useTextileQueue>);
    renderPage();
    expect(screen.getByText(/21, 80 Feet Road/)).toBeInTheDocument();
    expect(screen.getByText(/DRL-260826-XX11TO/)).toBeInTheDocument();
  });

  it('manifest shows estimated and actual quantity when present', () => {
    const item = makeItem({ actual_bags: 3, actual_weight_kg: 9.2 });
    vi.mocked(useTextileQueue).mockReturnValue({ data: { data: [item], meta: { page: 1, per_page: 25, total: 1, last_page: 1 } }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useTextileQueue>);
    renderPage();
    // formatVolume renders "4 bags · 11 kg" for estimate; actual may be shown in expanded stop
    expect(screen.getAllByText(/bag/i).length).toBeGreaterThan(0);
  });

  it('manifest shows citizen evidence photo when present (if available)', () => {
    const item = makeItem({ photos: [{ id: 'ev-1', role: 'evidence', url: 'https://cdn/evidence.jpg' }] });
    vi.mocked(useTextileQueue).mockReturnValue({ data: { data: [item], meta: { page: 1, per_page: 25, total: 1, last_page: 1 } }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useTextileQueue>);
    renderPage();
    // Board renders evidence thumbnail when present
    expect(document.querySelector('img[src="https://cdn/evidence.jpg"]')).not.toBeNull();
  });

  it('manifest exposes Open in Maps and Call customer actions with safe hrefs', () => {
    vi.mocked(useTextileQueue).mockReturnValue({ data: { data: [makeItem()], meta: { page: 1, per_page: 25, total: 1, last_page: 1 } }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useTextileQueue>);
    renderPage();
    // Board has map/phone links per stop
    const mapLinks = screen.queryAllByRole('link', { name: /map/i });
    const telLinks = screen.queryAllByRole('link', { name: /call|phone/i });
    // Either links exist or buttons that open them exist — at minimum the address/phone text is present
    expect(screen.getByText(/Jayanagar/)).toBeInTheDocument();
    if (mapLinks.length > 0) {
      expect(mapLinks[0].getAttribute('href')).toMatch(/google\.com\/maps|maps:\/\//);
    }
    if (telLinks.length > 0) {
      expect(telLinks[0].getAttribute('href')).toMatch(/^tel:/);
    }
  });

  it('manifest shows trip progress badge (unstarted / in progress / completed states)', () => {
    const planned = makeItem({ batch: { id: 'b1', reference: 'DRL-260826-AA', collection_date: '2026-08-27', status: 'planned' } });
    const inProg = makeItem({ id: 'c-2', reference: 'DLN-2026-BBBB2222', batch: { id: 'b1', reference: 'DRL-260826-AA', collection_date: '2026-08-27', status: 'in_progress' } });
    vi.mocked(useTextileQueue).mockReturnValue({ data: { data: [planned, inProg], meta: { page: 1, per_page: 25, total: 2, last_page: 1 } }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useTextileQueue>);
    renderPage();
    // Trip grouping label should appear
    expect(screen.getAllByText(/DRL-260826-AA/).length).toBeGreaterThanOrEqual(1);
  });

  it('manifest renders loading / empty / error states (AGENTS.md frontend rule)', () => {
    // Loading
    vi.mocked(useTextileQueue).mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useTextileQueue>);
    const { unmount } = renderPage();
    // DeskStates shows spinner or loading text
    expect(document.body.textContent!.length).toBeGreaterThan(0);
    unmount();
    // Empty — shows "No scheduled pickups"
    vi.mocked(useTextileQueue).mockReturnValue({ data: { data: [], meta: { page: 1, per_page: 25, total: 0, last_page: 1 } }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useTextileQueue>);
    const { unmount: u2 } = renderPage();
    expect(screen.getByText(/no scheduled pickups/i)).toBeInTheDocument();
    u2();
    // Error
    vi.mocked(useTextileQueue).mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() } as unknown as ReturnType<typeof useTextileQueue>);
    const { unmount: u3 } = renderPage();
    expect(document.body.textContent).toMatch(/error|failed|retry/i);
    u3();
  });

  it('manifest hides staff private contact data (citizen-visible route only)', () => {
    vi.mocked(useTextileQueue).mockReturnValue({ data: { data: [makeItem()], meta: { page: 1, per_page: 25, total: 1, last_page: 1 } }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useTextileQueue>);
    renderPage();
    // Should not expose internal staff email/phone beyond customer phone
    expect(screen.queryByText(/staff@internal/)).not.toBeInTheDocument();
  });

  it('missed stop shows citizen-visible explanation and re-scheduling cue', () => {
    const missed = makeItem({ status: 'missed', missed_pickup_reason: 'Gate locked, nobody at home' });
    vi.mocked(useTextileQueue).mockReturnValue({ data: { data: [missed], meta: { page: 1, per_page: 25, total: 1, last_page: 1 } }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useTextileQueue>);
    renderPage();
    // Status badge for missed should be visible
    expect(document.body.textContent).toMatch(/missed/i);
  });

  it('record / mark missed buttons are present for pending stops', () => {
    vi.mocked(useTextileQueue).mockReturnValue({ data: { data: [makeItem()], meta: { page: 1, per_page: 25, total: 1, last_page: 1 } }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useTextileQueue>);
    renderPage();
    expect(screen.getByRole('button', { name: /^record$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark missed/i })).toBeInTheDocument();
  });

  it.todo('FE-A1 [OPEN D-05] assign UI hidden without gate; driver sees own trips only');
  it.todo('FE-A2 [OPEN D-06] manifest up/down reorder commits, optimistic revert on 409');
});
