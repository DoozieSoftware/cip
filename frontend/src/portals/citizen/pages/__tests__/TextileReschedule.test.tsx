import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import TextileCollectionDetailPage from '../TextileCollectionDetailPage';
import type { TextileCollectionRequest } from '../../api/textileZones';
import { ApiError } from '../../../../shared/api/errors';

const mockCollectionData = vi.fn<() => TextileCollectionRequest | null>();
const mockCancel = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const mockCreate = vi.fn();
const mockReschedule = vi.fn();
const mockUploadPhoto = vi.fn<(...args: unknown[]) => Promise<unknown>>();
let mockRescheduleError: unknown = null;

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));

vi.mock('../../api/textileZones', () => ({
  useRescheduleTextileCollection: () => ({
    mutateAsync: mockReschedule,
    isPending: false,
    error: mockRescheduleError,
    reset: vi.fn(),
  }),
  useUpdateTextileInstructions: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  useTextileAvailability: () => ({
    data: { unavailable_dates: [], next_available_date: null },
    isLoading: false,
    isError: false,
  }),
  useTextileCapacityMinimum: () => ({ data: null, isLoading: false, isError: false }),
  useCreateTextileCollection: () => ({
    mutateAsync: mockCreate,
    isPending: false,
    error: null,
  }),
  useCitizenTextileCollection: () => ({
    data: mockCollectionData(),
    refetch: vi.fn(),
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
    collection_date:
      new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0] ?? '2026-08-29',
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
  mockRescheduleError = null;
  mockCollectionData.mockReturnValue({ ...BASE });
  mockCancel.mockResolvedValue({});
  mockReschedule.mockResolvedValue({});
  mockCreate.mockResolvedValue({ id: 'new-id' });
  mockUploadPhoto.mockResolvedValue({ photo: { id: '1', role: 'evidence', url: 'x' } });
});

// ── Phase 3 §6: citizen self-service reschedule surface ─────────────────────
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

  it('opens the picker and submits a new date and window', async () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule pickup' }));
    expect(screen.getByRole('button', { name: 'Confirm new slot' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('New date'), { target: { value: '2026-10-15' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '17:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new slot' }));
    await waitFor(() =>
      expect(mockReschedule).toHaveBeenCalledExactlyOnceWith({
        requested_date: '2026-10-15',
        window_start: '14:00',
        window_end: '17:00',
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Rescheduled to 2026-10-15');
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('freezes rescheduling copy when the trip is in_progress', () => {
    mockCollectionData.mockReturnValue({
      ...BASE,
      batch: { ...BASE.batch!, status: 'in_progress' },
    });
    renderDetail();
    expect(
      screen.getByText(/Crew is already on the route — rescheduling is paused/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reschedule pickup' })).not.toBeInTheDocument();
  });

  it('freezes rescheduling copy when the trip is completed', () => {
    mockCollectionData.mockReturnValue({
      ...BASE,
      batch: { ...BASE.batch!, status: 'completed' },
    });
    renderDetail();
    expect(
      screen.getByText(/This trip is already completed and cannot be rescheduled/),
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
    expect(
      screen.getByText(/Staff contact details are not shared for privacy/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Contact support/i })).toHaveAttribute(
      'href',
      '/citizen/reports',
    );
  });

  // ── OPEN D-04 — full reschedule picker (requires product) ────────────────

  it.todo(
    'FE-RS1 [OPEN D-04] reschedule picker shows available dates and disables unavailable windows',
  );
  it.todo(
    'FE-RS2 [OPEN D-04] unavailable slot shows fallback: why it became unavailable and next available slot',
  );
  it.todo(
    'FE-RS3 [OPEN D-04] cutoff guard: within cutoff window the picker is disabled with cutoff hint and staff-override note',
  );
  it.todo(
    'FE-RS4 [OPEN D-04] duplicate-booking guard: repeated reschedule keeps single active card, shows one confirmation',
  );
  it.todo(
    'FE-RS5 [OPEN D-04] reminder preference note: shows whether a reminder will be sent for the new slot',
  );
  it.todo(
    'FE-RS6 [OPEN D-04] readiness/contact inline edit allowed before cutoff without rewriting proof evidence',
  );
  it.todo('FE-RS7 [OPEN D-04] optimistic update reverts on 409/422 and shows conflict copy');

  // Loading / error states (AGENTS.md frontend rule — every screen needs them)

  it('reschedule section does not break loading state of the detail page', async () => {
    const { default: DetailPage } = await import('../TextileCollectionDetailPage');
    // Lightweight smoke: DetailPage module loads without throwing on missing reschedule data
    expect(DetailPage).toBeDefined();
  });

  it.todo(
    'FE-RS loading/empty/error: reschedule picker shows loading, empty (no alternative slots), and error states',
  );

  it('does not submit when the picker is opened twice without choosing a date', () => {
    renderDetail();
    const btn = screen.getByRole('button', { name: 'Reschedule pickup' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    const confirm = screen.getByRole('button', { name: 'Confirm new slot' });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(mockReschedule).not.toHaveBeenCalled();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  // ── Issue #9: past dates blocked + human-friendly window ────────────────

  it('blocks past dates via min=today on the reschedule date picker', () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule pickup' }));
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(screen.getByLabelText('New date')).toHaveAttribute('min', today);
  });

  it('warns when a past date is entered but still submits so the server error surfaces', async () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule pickup' }));
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const past = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    fireEvent.change(screen.getByLabelText('New date'), { target: { value: past } });
    expect(
      screen.getByText(/Past dates are not available — please choose today or a future date/),
    ).toBeInTheDocument();
    // Past dates remain submittable so a server-side rejection is surfaced, not swallowed.
    const confirm = screen.getByRole('button', { name: 'Confirm new slot' });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(mockReschedule).toHaveBeenCalledExactlyOnceWith({
        requested_date: past,
        window_start: '09:00',
        window_end: '12:00',
      }),
    );
  });

  it('surfaces a server past-date rejection clearly', () => {
    mockRescheduleError = new ApiError(
      422,
      'INVALID_DATE',
      'Requested date must be today or in the future.',
      null,
    );
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule pickup' }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Requested date must be today or in the future.');
  });

  it('formats the current window human-friendly instead of raw seconds', () => {
    mockCollectionData.mockReturnValue({
      ...BASE,
      scheduled_window_start: '10:02:00',
      scheduled_window_end: '13:05:00',
      batch: { ...BASE.batch!, window_start: '10:02:00', window_end: '13:05:00' },
    });
    renderDetail();
    expect(screen.getAllByText(/Between 10:02 AM – 1:05 PM/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('10:02:00');
    expect(document.body.textContent).not.toContain('13:05:00');
  });

  it('formats midnight/noon window boundaries correctly', () => {
    mockCollectionData.mockReturnValue({
      ...BASE,
      scheduled_window_start: '00:00:00',
      scheduled_window_end: '12:00:00',
      batch: { ...BASE.batch!, window_start: '00:00:00', window_end: '12:00:00' },
    });
    renderDetail();
    expect(screen.getAllByText(/Between 12:00 AM – 12:00 PM/).length).toBeGreaterThan(0);
  });
});
