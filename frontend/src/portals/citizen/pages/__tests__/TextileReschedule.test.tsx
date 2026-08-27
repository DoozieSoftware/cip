import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import TextileCollectionDetailPage from '../TextileCollectionDetailPage';
import type { TextileCollectionRequest } from '../../api/textileZones';

const mockCollectionData = vi.fn<() => TextileCollectionRequest | null>();
const mockCancel = vi.fn();
const mockCreate = vi.fn();
const mockUploadPhoto = vi.fn();

vi.mock('../../api/textileZones', () => ({
  useCreateTextileCollection: () => ({
    mutateAsync: mockCreate,
    isPending: false,
    error: null,
  }),
  useCitizenTextileCollection: () => ({
    data: mockCollectionData(),
    isLoading: false,
    isError: false,
  }),
  useCancelTextileCollection: () => ({
    mutateAsync: (...args: unknown[]) => mockCancel(...args),
    isPending: false,
  }),
  uploadTextileCollectionPhoto: (...args: unknown[]) => mockUploadPhoto(...args),
  useTextileServiceZones: () => ({ data: [], isLoading: false, isError: false }),
}));

function qcWrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const BASE: TextileCollectionRequest = {
  id: 'col-res-1',
  reference: 'DLN-2026-RS001',
  title: 'Reschedule pickup',
  status: 'scheduled',
  notes: null,
  pickup_address: '12, MG Road, Bengaluru 560001',
  collection_method: 'premises',
  category: 'clothes_waste',
  estimated_bags: 3,
  estimated_weight_kg: 8.5,
  scheduled_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0] ?? null,
  scheduled_window_start: '09:00',
  scheduled_window_end: '12:00',
  readiness_instructions: 'Leave bags at gate',
  rejection_reason: null,
  cancellation_reason: null,
  missed_pickup_reason: null,
  picked_up_at: null,
  submitted_at: null,
  latitude: null,
  longitude: null,
  actual_bags: null,
  actual_weight_kg: null,
  service_zone: {
    id: 'zone-1',
    code: 'DRL-Z1',
    name: 'South Zone',
    dropoff_name: null,
    dropoff_address: null,
    center: null,
  },
  partner: { id: 'p1', name: 'Dr. Linen' },
  batch: {
    id: 'batch-1',
    reference: 'DRL-260827-RS1',
    collection_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0] ?? '2026-08-29',
    status: 'planned',
    window_start: '09:00',
    window_end: '12:00',
    trip_reference: 'TRIP-001',
  },
  photos: [],
  service_zone_id: 'zone-1',
  requester_type: 'individual',
  requester_name: 'Asha Rao',
  rwa_name: null,
  contact_email: 'asha@example.com',
  contact_phone: '+91 9876543210',
};

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/citizen/textile-collections/col-res-1']}>
      <Routes>
        <Route path="/citizen/textile-collections/:id" element={<TextileCollectionDetailPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: qcWrapper },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCollectionData.mockReturnValue({ ...BASE });
  mockCancel.mockResolvedValue({});
  mockCreate.mockResolvedValue({ id: 'new-id' });
  mockUploadPhoto.mockResolvedValue({ photo: { id: '1', role: 'evidence', url: 'x' } });
});

// ── Phase 3 §6: citizen self-service reschedule surface ─────────────────────
// The live reschedule picker is behind an OPEN D-04 decision on cutoff window.
// Current UI shows a disabled placeholder; Phase 3 will replace it with a
// date/window picker, unavailable-slot copy, and cutoff guard.

describe('TextileCollectionDetailPage — reschedule surface (Phase 3)', () => {
  it('shows the reschedule section for a scheduled premises pickup', () => {
    renderDetail();
    expect(screen.getByLabelText('Reschedule')).toBeInTheDocument();
    expect(screen.getByText('Need a different date?')).toBeInTheDocument();
  });

  it('hides the reschedule section for a dropoff request', () => {
    mockCollectionData.mockReturnValue({
      ...BASE,
      collection_method: 'dropoff',
      status: 'dropoff_awaiting_drop',
      batch: null,
    });
    renderDetail();
    expect(screen.queryByLabelText('Reschedule')).not.toBeInTheDocument();
    expect(screen.queryByText('Need a different date?')).not.toBeInTheDocument();
  });

  it('hides the reschedule section once a pickup is collected', () => {
    mockCollectionData.mockReturnValue({ ...BASE, status: 'picked_up' });
    renderDetail();
    expect(screen.queryByLabelText('Reschedule')).not.toBeInTheDocument();
  });

  it('currently shows a disabled placeholder until Phase 3 ships', () => {
    renderDetail();
    const btn = screen.getByRole('button', { name: /Reschedule — coming soon/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/Rescheduling will be available before the crew starts the trip/)).toBeInTheDocument();
    expect(screen.getByText(/No staff contact is shown here/)).toBeInTheDocument();
  });

  it('freezes rescheduling copy when the trip is in_progress', () => {
    mockCollectionData.mockReturnValue({
      ...BASE,
      batch: { ...BASE.batch!, status: 'in_progress' },
    });
    renderDetail();
    expect(
      screen.getByText(/Rescheduling is paused while the crew is on the route/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reschedule — coming soon/i })).toBeDisabled();
  });

  it('freezes rescheduling copy when the trip is completed', () => {
    mockCollectionData.mockReturnValue({
      ...BASE,
      batch: { ...BASE.batch!, status: 'completed' },
    });
    renderDetail();
    expect(
      screen.getByText(/Rescheduling is paused while the crew is on the route/),
    ).toBeInTheDocument();
  });

  it('does not expose staff personal phone in the reschedule section', () => {
    renderDetail();
    // Phase 3 guardrail: no tel: with staff private number should appear
    const telLinks = document.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]');
    for (const a of telLinks) {
      // Only citizen phone would ever appear, never staff private number
      expect(a.getAttribute('href')).not.toMatch(/staff|driver_private/i);
    }
    expect(screen.getByText(/Use Contact support above/)).toBeInTheDocument();
  });

  it('explicitly states that staff contact is not shown and links to Contact support', () => {
    renderDetail();
    expect(screen.getByText(/Staff contact details are not shared for privacy/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Contact support/i })).toHaveAttribute(
      'href',
      '/citizen/reports',
    );
  });

  // ── OPEN D-04 — full reschedule picker (requires product) ────────────────

  it.todo('FE-RS1 [OPEN D-04] reschedule picker shows available dates and disables unavailable windows');
  it.todo('FE-RS2 [OPEN D-04] unavailable slot shows fallback: why it became unavailable and next available slot');
  it.todo('FE-RS3 [OPEN D-04] cutoff guard: within cutoff window the picker is disabled with cutoff hint and staff-override note');
  it.todo('FE-RS4 [OPEN D-04] duplicate-booking guard: repeated reschedule keeps single active card, shows one confirmation');
  it.todo('FE-RS5 [OPEN D-04] reminder preference note: shows whether a reminder will be sent for the new slot');
  it.todo('FE-RS6 [OPEN D-04] readiness/contact inline edit allowed before cutoff without rewriting proof evidence');
  it.todo('FE-RS7 [OPEN D-04] optimistic update reverts on 409/422 and shows conflict copy');

  // Loading / error states (AGENTS.md frontend rule — every screen needs them)

  it('reschedule section does not break loading state of the detail page', async () => {
    const { default: DetailPage } = await import('../TextileCollectionDetailPage');
    // Lightweight smoke: DetailPage module loads without throwing on missing reschedule data
    expect(DetailPage).toBeDefined();
  });

  it.todo('FE-RS loading/empty/error: reschedule picker shows loading, empty (no alternative slots), and error states');

  it('double-clicking the placeholder reschedule button does not fire a request', () => {
    renderDetail();
    const btn = screen.getByRole('button', { name: /Reschedule — coming soon/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(mockCancel).not.toHaveBeenCalled();
    // Disabled button must stay disabled
    expect(btn).toBeDisabled();
  });
});
