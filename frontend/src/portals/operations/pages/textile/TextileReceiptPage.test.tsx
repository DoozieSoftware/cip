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

  const confirm = await screen.findByRole('button', { name: 'Confirm receipt' });
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

  it('replaces the form with a success state showing ref + bags/kg', async () => {
    renderPage();
    await fillAndConfirm();

    const heading = await screen.findByRole('heading', { name: 'Receipt confirmed' });
    expect(heading).toBeVisible();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(ITEM.reference);
    expect(status).toHaveTextContent('4 bags');
    expect(status).toHaveTextContent('11 kg');
    expect(document.activeElement).toBe(heading);
  });

  it('makes double-submit impossible (form unmounted, single mutation)', async () => {
    renderPage();
    await fillAndConfirm();

    await screen.findByRole('heading', { name: 'Receipt confirmed' });

    await waitFor(() => {
      expect(vi.mocked(recordDropoffReceipt)).toHaveBeenCalledTimes(1);
    });
    // The confirm action is gone with the form — staff cannot tap it again.
    expect(screen.queryByRole('button', { name: 'Confirm receipt' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirming…' })).not.toBeInTheDocument();
  });

  it('resets to a fresh form via Find next booking', async () => {
    renderPage();
    await fillAndConfirm();

    await screen.findByRole('heading', { name: 'Receipt confirmed' });

    fireEvent.click(screen.getByRole('button', { name: 'Find next booking' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Receipt confirmed' })).not.toBeInTheDocument();
    });
    // Fresh form: empty-state copy returns and the success summary is cleared.
    expect(await screen.findByText('Select a booking')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Confirm receipt' })).not.toBeInTheDocument();
    const searchInput = screen.getByRole('textbox', {
      name: 'Search by reference or phone',
    });
    expect(searchInput).toHaveValue('');
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
