import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TextileCollectionListItem } from '../../api/textileApi';
import type * as TextileApi from '../../api/textileApi';
import {
  collectTextileWithProof,
  fetchTextileDetail,
  recordTextileOutcome,
} from '../../api/textileApi';
import type * as TextileShared from './shared';
import TextileStopPage from './TextileStopPage';
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

vi.mock('../../api/textileApi', async () => {
  const actual = await vi.importActual<typeof TextileApi>('../../api/textileApi');
  return {
    ...actual,
    fetchTextileDetail: vi.fn(),
    collectTextileWithProof: vi.fn(),
    recordTextileOutcome: vi.fn(),
  };
});

vi.mock('./hooks/useOfflineQueue', () => ({
  useOfflineQueue: () => ({ items: [] }),
}));

vi.mock('../../offline/useOpsQueue', () => ({
  useOpsQueue: () => ({
    items: [],
    pending: [],
    dead: [],
    done: [],
    isOnline: true,
    drain: vi.fn(),
  }),
}));

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
  readiness_instructions: 'Leave bags at gate',
  rejection_reason: null,
  missed_pickup_reason: null,
  picked_up_at: null,
  service_zone: null,
  batch: {
    id: 'batch-1',
    reference: 'DRL-260826-XX11TO',
    collection_date: '2026-08-27',
    status: 'scheduled',
    driver_name: 'Ravi',
    team_name: 'Team A',
    vehicle_label: 'KA-01-1234',
  },
  submitted_at: '2026-08-26T10:00:00+05:30',
  photos: [{ id: 'ev-1', role: 'evidence', url: 'https://cdn/citizen-evidence.jpg' }],
  category: 'clothes_waste',
  partner: { id: 'partner-1', name: 'Dr. Linen' },
};

function renderStopPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter
      initialEntries={['/operations/textile-collections/dispatch/batch-1/stops/collection-1']}
    >
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route
            path="/operations/textile-collections/dispatch/:batchId/stops/:stopId"
            element={<TextileStopPage />}
          />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('TextileStopPage', () => {
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
    vi.mocked(fetchTextileDetail).mockResolvedValue(ITEM);
    vi.mocked(collectTextileWithProof).mockResolvedValue(ITEM);
    vi.mocked(recordTextileOutcome).mockResolvedValue(ITEM);
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

  it('renders trip context, stop detail and the full action set from a deep link', async () => {
    renderStopPage();

    expect(await screen.findByText('Lakshmi Devi')).toBeVisible();
    expect(screen.getByText('21, 11th Main, Jayanagar, Bengaluru 560041')).toBeVisible();
    expect(screen.getByText(/DRL-260826-XX11TO/)).toBeVisible();
    expect(screen.getByText(/Stop 1 of 1/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to dispatch board' })).toHaveAttribute(
      'href',
      '/operations/textile-collections/dispatch',
    );
    // Estimate + instructions + evidence
    expect(screen.getAllByText(/4 bags · 11 kg/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Leave bags at gate/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByAltText('citizen evidence').length).toBeGreaterThanOrEqual(1);
    // Full action set with the same labels/handlers as the board workflow
    expect(screen.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+919876543210');
    expect(screen.getByRole('link', { name: 'Navigate' }).getAttribute('href')).toMatch(
      /google\.com\/maps|maps:\/\//,
    );
    expect(screen.getAllByRole('button', { name: 'Mark missed' }).length).toBe(2);
    // desktop inline copy + mobile "More actions" copy
    expect(screen.getByText('More actions')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Record this stop' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose proof photo' })).toBeVisible();
    expect(vi.mocked(fetchTextileDetail)).toHaveBeenCalledWith('collection-1', 'department-1');
  });

  it('records a collection with actuals and required proof photo', async () => {
    renderStopPage();

    await screen.findByText('Lakshmi Devi');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['proof'], 'proof.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const confirm = await screen.findByRole('button', { name: 'Confirm collected' });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(vi.mocked(collectTextileWithProof)).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(collectTextileWithProof)).toHaveBeenCalledWith(
      'collection-1',
      expect.objectContaining({ actual_bags: 4, actual_weight_kg: 11 }),
      'department-1',
    );
    const payload = vi.mocked(collectTextileWithProof).mock.calls[0][1];
    expect(payload.photo).toBe(file);
    expect(typeof payload.idempotencyKey).toBe('string');
  });

  it('uses an accessible proof-photo button instead of exposing the raw file picker', async () => {
    renderStopPage();

    await screen.findByText('Lakshmi Devi');

    const picker = screen.getByRole('button', { name: 'Choose proof photo' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    expect(picker).toBeVisible();
    expect(screen.getByText('JPG, PNG or WebP, up to 10 MB.')).toBeVisible();
    expect(fileInput).toHaveClass('sr-only');
    expect(fileInput).toHaveAttribute('tabindex', '-1');

    fireEvent.click(picker);

    expect(clickSpy).toHaveBeenCalledOnce();
    clickSpy.mockRestore();
  });
});
