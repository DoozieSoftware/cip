import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TextileCollectionListItem } from '../../api/textileApi';
import type * as TextileShared from './shared';
import TextileStaffDetailPage from './TextileStaffDetailPage';
import { useDesk } from './shared';
import * as textileApi from '../../api/textileApi';

vi.mock('./shared', async () => {
  const actual = await vi.importActual<typeof TextileShared>('./shared');
  return {
    ...actual,
    useDesk: vi.fn(),
  };
});

vi.mock('../../api/textileApi', async () => {
  const actual = await vi.importActual<typeof textileApi>('../../api/textileApi');
  return {
    ...actual,
    fetchTextileDetail: vi.fn(),
    approveTextileCollection: vi.fn().mockResolvedValue({ status: 'success' }),
    recordTextileOutcome: vi.fn().mockResolvedValue({ status: 'success' }),
    updateTextileZoneDropoff: vi.fn().mockResolvedValue({ status: 'success' }),
  };
});

const ITEM: TextileCollectionListItem = {
  id: 'item-123',
  reference: 'DLN-2026-0099',
  title: 'Cotton bedsheets and jeans',
  notes: 'Please buzz apartment 402',
  status: 'pending_review',
  requester_type: 'individual',
  requester_name: 'Ananya Sharma',
  rwa_name: null,
  contact_email: 'ananya@example.test',
  contact_phone: '+919988776655',
  pickup_address: '402 Sunrise Heights, Indiranagar, Bengaluru',
  collection_method: 'premises',
  estimated_bags: 3,
  estimated_weight_kg: 8.5,
  actual_bags: null,
  actual_weight_kg: null,
  scheduled_date: null,
  scheduled_window_start: null,
  scheduled_window_end: null,
  readiness_instructions: null,
  rejection_reason: null,
  missed_pickup_reason: null,
  picked_up_at: null,
  service_zone: {
    id: 'zone-indiranagar',
    code: 'INDIRANAGAR',
    name: 'Indiranagar',
    dropoff_name: null,
    dropoff_address: null,
  },
  batch: null,
  submitted_at: '2026-09-01T10:00:00+05:30',
  photos: [
    {
      id: 'photo-1',
      role: 'evidence',
      url: 'https://cdn.example.com/evidence.jpg',
    },
  ],
  category: 'clothes_waste',
  partner: { id: 'partner-1', name: 'Dr. Linen' },
};

function renderDetail(routeId = 'item-123') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[`/operations/textile-collections/${routeId}`]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/operations/textile-collections/:id" element={<TextileStaffDetailPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('TextileStaffDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDesk).mockReturnValue({
      ready: true,
      isDrLinen: true,
      departmentId: 'dept-dr-linen',
    });
    vi.mocked(textileApi.fetchTextileDetail).mockResolvedValue(ITEM);
  });

  it('renders loading state when desk is not ready', () => {
    vi.mocked(useDesk).mockReturnValue({
      ready: false,
      isDrLinen: false,
      departmentId: undefined,
    });
    renderDetail();
    expect(screen.getByText('Loading…')).toBeVisible();
  });

  it('renders switch message when not Dr. Linen', () => {
    vi.mocked(useDesk).mockReturnValue({
      ready: true,
      isDrLinen: false,
      departmentId: 'dept-other',
    });
    renderDetail();
    expect(screen.getByText('Switch to Dr. Linen to view this request.')).toBeVisible();
  });

  it('renders request details, citizen note, and action buttons', async () => {
    renderDetail();

    expect((await screen.findAllByText('DLN-2026-0099')).length).toBeGreaterThan(0);
    expect(screen.getByText('Cotton bedsheets and jeans')).toBeVisible();
    expect(screen.getByText(/Please buzz apartment 402/)).toBeVisible();
    expect(screen.getByText('Ananya Sharma')).toBeVisible();
    expect(screen.getByText('+919988776655')).toBeVisible();
    expect(screen.getByText('ananya@example.test')).toBeVisible();
    expect(screen.getByText('402 Sunrise Heights, Indiranagar, Bengaluru')).toBeVisible();

    expect(screen.getByRole('button', { name: 'Approve request' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeVisible();
  });

  it('approves a request when clicking Approve request', async () => {
    renderDetail();
    const approveBtn = await screen.findByRole('button', { name: 'Approve request' });

    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(textileApi.approveTextileCollection).toHaveBeenCalledWith('item-123', 'dept-dr-linen');
    });
  });

  it('opens confirm dialog and rejects with a reason', async () => {
    renderDetail();
    const rejectBtn = await screen.findByRole('button', { name: 'Reject' });

    fireEvent.click(rejectBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeVisible();

    const noteInput = screen.getByLabelText(/Note/i);
    fireEvent.change(noteInput, { target: { value: 'Item is not accepted textile category' } });

    const confirmReject = screen.getByRole('button', { name: 'Reject request' });
    fireEvent.click(confirmReject);

    await waitFor(() => {
      expect(textileApi.recordTextileOutcome).toHaveBeenCalledWith('item-123', {
        outcome: 'rejected',
        reason: 'Item is not accepted textile category',
        department_id: 'dept-dr-linen',
      });
    });
  });

  it('allows editing drop-off details when collection method is dropoff', async () => {
    const dropoffItem: TextileCollectionListItem = {
      ...ITEM,
      collection_method: 'dropoff',
      status: 'dropoff_awaiting_drop',
      service_zone: {
        id: 'zone-indiranagar',
        code: 'INDIRANAGAR',
        name: 'Indiranagar',
        dropoff_name: 'Main Centre',
        dropoff_address: '100 Feet Rd',
      },
    };
    vi.mocked(textileApi.fetchTextileDetail).mockResolvedValue(dropoffItem);

    renderDetail();

    expect(await screen.findByText('Main Centre')).toBeVisible();
    const editBtn = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editBtn);

    const nameInput = screen.getByLabelText(/Drop-off name/i);
    fireEvent.change(nameInput, { target: { value: 'Updated Centre' } });

    const saveBtn = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(textileApi.updateTextileZoneDropoff).toHaveBeenCalledWith(
        'zone-indiranagar',
        { dropoff_name: 'Updated Centre', dropoff_address: '100 Feet Rd' },
        'dept-dr-linen',
      );
    });
  });

  it('shows scheduling navigation when ready to group', async () => {
    const readyItem: TextileCollectionListItem = {
      ...ITEM,
      status: 'ready_to_group',
    };
    vi.mocked(textileApi.fetchTextileDetail).mockResolvedValue(readyItem);

    renderDetail();

    expect(await screen.findByRole('button', { name: /Open trip scheduling desk/i })).toBeVisible();
  });

  // Regression (#23): with no citizen photo the Photos section used to vanish,
  // leaving the approver unsure whether nothing was uploaded or loading failed.
  it('shows an explicit empty photo state while awaiting review', async () => {
    vi.mocked(textileApi.fetchTextileDetail).mockResolvedValue({ ...ITEM, photos: [] });

    renderDetail();

    expect(await screen.findByText('Photos & Proof')).toBeVisible();
    expect(screen.getByText(/No citizen photo uploaded/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Approve request' })).toBeVisible();
  });
});
