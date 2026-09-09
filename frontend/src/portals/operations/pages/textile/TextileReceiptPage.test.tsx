import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TextileCollectionListItem } from '../../api/textileApi';
import type * as TextileApi from '../../api/textileApi';
import { recordDropoffReceipt, uploadTextileProofPhoto } from '../../api/textileApi';
import type * as TextileShared from './shared';
import TextileReceiptPage from './TextileReceiptPage';
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
    recordDropoffReceipt: vi.fn(),
    uploadTextileProofPhoto: vi.fn(),
  };
});

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));

vi.mock('../../../citizen/components/CameraCapture', () => ({
  CameraCapture: ({
    onCapture,
    onError,
  }: {
    onCapture: (file: File, capturedAt: string) => void;
    onError?: (err: { kind: string; message: string }) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onCapture(
            new File(['camera-snap'], 'snap.jpg', { type: 'image/jpeg' }),
            new Date().toISOString(),
          )
        }
      >
        Mock capture photo
      </button>
      <button
        type="button"
        onClick={() =>
          onError?.({ kind: 'permission_denied', message: 'Camera permission is blocked' })
        }
      >
        Mock camera error
      </button>
    </div>
  ),
}));

const ITEM: TextileCollectionListItem = {
  id: 'collection-1',
  reference: 'DL-2026-0001',
  title: 'Bags and shoes',
  notes: null,
  status: 'dropoff_awaiting_drop',
  requester_type: 'individual',
  requester_name: 'Lakshmi Devi',
  rwa_name: null,
  contact_email: 'lakshmi@example.test',
  contact_phone: '+919876543210',
  pickup_address: '21, 11th Main, Jayanagar, Bengaluru 560041',
  collection_method: 'dropoff',
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
  service_zone: {
    id: 'zone-1',
    code: 'ZONE-1',
    name: 'Jayanagar',
    dropoff_name: 'Centre 1',
    dropoff_address: '1 Main Road',
  },
  dropoff_centre: {
    id: 'centre-1',
    name: 'Jayanagar Main Centre',
    address: '1 Main Road',
  },
  batch: null,
  submitted_at: '2026-08-26T10:00:00+05:30',
  photos: [],
  category: 'clothes_waste',
  partner: { id: 'partner-1', name: 'Dr. Linen' },
};

function mockQueueSuccess() {
  vi.mocked(useTextileQueue).mockReturnValue({
    data: {
      data: [ITEM],
      meta: { page: 1, per_page: 25, total: 1, last_page: 1 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTextileQueue>);
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <TextileReceiptPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

async function searchAndSelect() {
  const searchInput = screen.getByRole('textbox', { name: 'Search by reference or phone' });
  fireEvent.change(searchInput, { target: { value: ITEM.reference } });
  fireEvent.click(screen.getByRole('button', { name: 'Find' }));
  // Auto-select resolves the single queue row once `search` is committed.
  // The requester line also includes the masked phone, so wait on the
  // reference badge (exact single-node match) plus the weigh form.
  await screen.findByText(ITEM.reference);
  await screen.findByLabelText(/Actual bags/);
}

async function fillAndConfirm() {
  await searchAndSelect();

  fireEvent.change(screen.getByLabelText(/Actual bags/), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText(/Actual weight/), { target: { value: '11' } });

  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['proof'], 'proof.jpg', { type: 'image/jpeg' });
  fireEvent.change(fileInput, { target: { files: [file] } });

  const confirm = await screen.findByRole('button', { name: 'Confirm pickup request' });
  expect(confirm).toBeEnabled();
  fireEvent.click(confirm);

  return confirm;
}

describe('TextileReceiptPage receipt success state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDesk).mockReturnValue({
      ready: true,
      isDrLinen: true,
      departmentId: 'department-1',
    });
    mockQueueSuccess();
    vi.mocked(uploadTextileProofPhoto).mockResolvedValue({
      photo: { id: 'media-1', role: 'proof', url: 'https://cdn/proof.jpg' },
    });
    vi.mocked(recordDropoffReceipt).mockResolvedValue({
      id: 'receipt-1',
      collection_request_id: 'collection-1',
    });
    if (!('createObjectURL' in URL) || typeof URL.createObjectURL !== 'function') {
      (URL as unknown as { createObjectURL: (f: File) => string }).createObjectURL = () =>
        'blob:mock';
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    }
  });

  it('uses one booking lookup field with no duplicate paste field', () => {
    renderPage();

    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.getByRole('textbox', { name: 'Search by reference or phone' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Paste a receipt code' })).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Paste booking QR reference' })).toBeNull();
  });

  it('replaces the form with a success state showing ref + bags/kg', async () => {
    renderPage();
    await fillAndConfirm();

    const heading = await screen.findByRole('heading', { name: 'Pickup request confirmed' });
    expect(heading).toBeVisible();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(ITEM.reference);
    expect(status).toHaveTextContent('4 bags');
    expect(status).toHaveTextContent('11 kg');
    expect(document.activeElement).toBe(heading);
  });

  it('shows a printable bag receipt QR after confirming receipt', async () => {
    renderPage();
    await fillAndConfirm();

    await screen.findByRole('heading', { name: 'Pickup request confirmed' });
    expect(screen.getByRole('region', { name: 'Bag receipt' })).toBeVisible();
    expect(screen.getByText('Lakshmi Devi')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Print bag label' })).toBeVisible();
  });

  it('calls the variance field Remarks instead of Reason', async () => {
    renderPage();
    await searchAndSelect();

    fireEvent.change(screen.getByLabelText(/Actual bags/), { target: { value: '5' } });

    expect(screen.getByLabelText(/Remarks/)).toBeVisible();
    expect(screen.getByRole('option', { name: 'Select remark' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Additional remarks (optional)')).toBeVisible();
    expect(screen.queryByText(/Reason/)).not.toBeInTheDocument();
  });

  it('makes double-submit impossible (form unmounted, single mutation)', async () => {
    renderPage();
    await fillAndConfirm();

    await screen.findByRole('heading', { name: 'Pickup request confirmed' });

    await waitFor(() => {
      expect(vi.mocked(recordDropoffReceipt)).toHaveBeenCalledTimes(1);
    });
    // The confirm action is gone with the form — staff cannot tap it again.
    expect(
      screen.queryByRole('button', { name: 'Confirm pickup request' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirming…' })).not.toBeInTheDocument();
  });

  it('resets to a fresh form via Find next booking', async () => {
    renderPage();
    await fillAndConfirm();

    await screen.findByRole('heading', { name: 'Pickup request confirmed' });

    fireEvent.click(screen.getByRole('button', { name: 'Find next booking' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Pickup request confirmed' }),
      ).not.toBeInTheDocument();
    });
    // Fresh form: empty-state copy returns and the success summary is cleared.
    expect(await screen.findByText('Select a booking')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Confirm pickup request' }),
    ).not.toBeInTheDocument();
    const searchInput = screen.getByRole('textbox', {
      name: 'Search by reference or phone',
    });
    expect(searchInput).toHaveValue('');
  });

  it('captures the proof photo with Take photo and confirms pickup request', async () => {
    renderPage();
    await searchAndSelect();

    fireEvent.change(screen.getByLabelText(/Actual bags/), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(/Actual weight/), { target: { value: '11' } });

    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }));
    expect(await screen.findByRole('button', { name: 'Mock capture photo' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Mock capture photo' }));

    // Camera closes and the captured photo previews like a picked file.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Mock capture photo' })).not.toBeInTheDocument();
    });
    expect(screen.getByAltText('proof preview')).toBeVisible();

    const confirm = await screen.findByRole('button', { name: 'Confirm pickup request' });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(vi.mocked(uploadTextileProofPhoto)).toHaveBeenCalledTimes(1);
    });
    const uploaded = vi.mocked(uploadTextileProofPhoto).mock.calls[0][1];
    expect(uploaded).toBeInstanceOf(File);
    expect(uploaded.name).toBe('snap.jpg');
    expect(await screen.findByRole('heading', { name: 'Pickup request confirmed' })).toBeVisible();
  });

  it('shows camera errors with a file fallback', async () => {
    renderPage();
    await searchAndSelect();

    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mock camera error' }));

    expect(await screen.findByText(/Camera permission is blocked/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose a file instead' })).toBeVisible();

    // The file picker still works after a camera failure.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel camera' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Mock camera error' })).not.toBeInTheDocument();
    });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['proof'], 'proof.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByAltText('proof preview')).toBeVisible();
  });

  it('keeps the search error/retry state', async () => {
    vi.mocked(useTextileQueue).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTextileQueue>);
    renderPage();

    const searchInput = screen.getByRole('textbox', { name: 'Search by reference or phone' });
    fireEvent.change(searchInput, { target: { value: 'DL-UNKNOWN' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find' }));

    expect(await screen.findByText('Could not search bookings.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect(vi.mocked(recordDropoffReceipt)).not.toHaveBeenCalled();
  });
});
