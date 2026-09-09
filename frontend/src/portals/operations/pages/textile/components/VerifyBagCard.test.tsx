import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { TextileCollectionListItem } from '../../../api/textileApi';
import type * as TextileApi from '../../../api/textileApi';
import { lookupTextileByReference } from '../../../api/textileApi';
import { VerifyBagCard } from './VerifyBagCard';
import { encodeReceiptQr } from './receiptQr';

vi.mock('../../../api/textileApi', async () => {
  const actual = await vi.importActual<typeof TextileApi>('../../../api/textileApi');
  return { ...actual, lookupTextileByReference: vi.fn() };
});

const BOOKING = {
  id: 'collection-1',
  reference: 'DLN-2026-79FFFC75',
  requester_name: 'Lakshmi Devi',
  status: 'picked_up',
  actual_bags: 4,
  actual_weight_kg: 11,
} as TextileCollectionListItem;

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <VerifyBagCard departmentId="department-1" />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('VerifyBagCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('decodes a pasted receipt QR and matches it to the booking', async () => {
    vi.mocked(lookupTextileByReference).mockResolvedValue(BOOKING);
    renderCard();

    fireEvent.change(screen.getByLabelText('Paste a receipt code'), {
      target: {
        value: encodeReceiptQr({
          ref: 'DLN-2026-79FFFC75',
          name: 'Lakshmi Devi',
          bags: 4,
          kg: 11,
          at: '2026-09-09T10:30:00+05:30',
          via: 'DRL-260909-XX11TO',
          lane: 'premises',
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText(/Booking DLN-2026-79FFFC75/)).toBeVisible();
    expect(screen.getByText('Citizen name matches booking')).toBeVisible();
    expect(screen.getByText('Bag count matches weigh record')).toBeVisible();
    expect(screen.getByText('Weight matches weigh record')).toBeVisible();
    expect(vi.mocked(lookupTextileByReference)).toHaveBeenCalledWith(
      'DLN-2026-79FFFC75',
      'department-1',
    );
  });

  it('flags actuals that differ from the system weigh record', async () => {
    vi.mocked(lookupTextileByReference).mockResolvedValue({
      ...BOOKING,
      actual_bags: 5,
    });
    renderCard();

    fireEvent.change(screen.getByLabelText('Paste a receipt code'), {
      target: {
        value: encodeReceiptQr({
          ref: 'DLN-2026-79FFFC75',
          name: 'Lakshmi Devi',
          bags: 4,
          kg: 11,
          at: '2026-09-09T10:30:00+05:30',
          via: 'DRL-260909-XX11TO',
          lane: 'premises',
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText(/check before shelving/)).toBeVisible();
  });

  it('flags a booking that has not been collected or received yet', async () => {
    vi.mocked(lookupTextileByReference).mockResolvedValue({
      ...BOOKING,
      status: 'dropoff_awaiting_drop',
      actual_bags: null,
      actual_weight_kg: null,
    });
    renderCard();

    fireEvent.change(screen.getByLabelText('Paste a receipt code'), {
      target: {
        value: encodeReceiptQr({
          ref: 'DLN-2026-79FFFC75',
          name: 'Lakshmi Devi',
          bags: 4,
          kg: 11,
          at: '2026-09-09T10:30:00+05:30',
          via: 'Jayanagar Centre',
          lane: 'dropoff',
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(screen.getAllByText(/check before shelving/)).toHaveLength(3);
    });
  });

  it('rejects a booking-pass QR with a staff-readable error', async () => {
    renderCard();

    fireEvent.change(screen.getByLabelText('Paste a receipt code'), {
      target: { value: 'DLN-2026-79FFFC75' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not a bag receipt QR/);
    expect(vi.mocked(lookupTextileByReference)).not.toHaveBeenCalled();
  });

  it('keeps decoded details visible when the booking lookup fails offline', async () => {
    vi.mocked(lookupTextileByReference).mockRejectedValue(new Error('offline'));
    renderCard();

    fireEvent.change(screen.getByLabelText('Paste a receipt code'), {
      target: {
        value: encodeReceiptQr({
          ref: 'DLN-2026-79FFFC75',
          name: 'Lakshmi Devi',
          bags: 4,
          kg: 11,
          at: '2026-09-09T10:30:00+05:30',
          via: null,
          lane: 'dropoff',
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(screen.getByText(/still valid offline/)).toBeVisible();
    });
    expect(screen.getByText('DLN-2026-79FFFC75')).toBeVisible();
  });
});
