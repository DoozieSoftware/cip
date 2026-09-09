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

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="route-map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="route-pin">{children}</div>
  ),
  Polyline: () => <div data-testid="route-line" />,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn() }),
}));

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));

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
      initialEntries={['/operations/textile-collections/collections/batch-1/stops/collection-1']}
    >
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route
            path="/operations/textile-collections/collections/:batchId/stops/:stopId"
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
    expect(screen.getByText(/Collection 1 of 1/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to collections' })).toHaveAttribute(
      'href',
      '/operations/textile-collections/collections',
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
    expect(screen.getByRole('button', { name: 'Record this collection' })).toBeVisible();
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

  it('labels the variance field Remarks and keeps it required on variance', async () => {
    renderStopPage();

    await screen.findByText('Lakshmi Devi');

    // Prefilled actuals match the estimate, so no remarks field yet.
    expect(screen.queryByLabelText(/Remarks/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Actual bags/), { target: { value: '5' } });

    expect(await screen.findByLabelText(/Remarks/)).toBeVisible();
    expect(screen.getByPlaceholderText(/half a kg more than estimated/)).toBeVisible();
    expect(screen.getByText(/remarks required/)).toBeVisible();
    expect(screen.getByText(/and remarks.*to confirm/)).toBeVisible();
    expect(screen.queryByText(/reason required/i)).not.toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: 'Confirm collected' });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Remarks/), { target: { value: 'One extra bag' } });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['proof'], 'proof.jpg', { type: 'image/jpeg' })] },
    });

    expect(await screen.findByRole('button', { name: 'Confirm collected' })).toBeEnabled();
  });

  it('captures a proof photo with Take photo and submits it', async () => {
    renderStopPage();

    await screen.findByText('Lakshmi Devi');

    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }));
    expect(await screen.findByRole('button', { name: 'Mock capture photo' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Mock capture photo' }));

    // Camera closes and the captured photo previews like a picked file.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Mock capture photo' })).not.toBeInTheDocument();
    });
    expect(screen.getByAltText('preview')).toBeVisible();

    const confirm = await screen.findByRole('button', { name: 'Confirm collected' });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(vi.mocked(collectTextileWithProof)).toHaveBeenCalledTimes(1);
    });
    const payload = vi.mocked(collectTextileWithProof).mock.calls[0][1];
    expect(payload.photo).toBeInstanceOf(File);
    expect(payload.photo.name).toBe('snap.jpg');
  });

  it('shows camera errors with a file fallback', async () => {
    renderStopPage();

    await screen.findByText('Lakshmi Devi');

    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mock camera error' }));

    expect(await screen.findByText(/Camera permission is blocked/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose a file instead' })).toBeVisible();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Choose a file instead' }));
    expect(clickSpy).toHaveBeenCalledOnce();
    clickSpy.mockRestore();
  });

  it('shows a person-first success heading and drops trip arithmetic', async () => {
    const collected: TextileCollectionListItem = {
      ...ITEM,
      status: 'picked_up',
      requester_name: 'Divya Menon',
      actual_bags: 3,
      actual_weight_kg: 8.5,
      picked_up_at: '2026-08-27T10:30:00+05:30',
    };
    const peers: TextileCollectionListItem[] = [2, 3, 4].map((n) => ({
      ...ITEM,
      id: `collection-${n}`,
      reference: `DLN-2026-STOP${n}`,
      requester_name: `Neighbour ${n}`,
      status: 'scheduled',
      actual_bags: null,
      actual_weight_kg: null,
      picked_up_at: null,
    }));
    vi.mocked(fetchTextileDetail).mockResolvedValue(collected);
    vi.mocked(useTextileQueue).mockReturnValue({
      data: {
        data: [collected, ...peers],
        meta: { page: 1, per_page: 25, total: 4, last_page: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTextileQueue>);
    renderStopPage();

    expect(await screen.findByRole('heading', { name: 'Divya Menon collected' })).toBeVisible();
    expect(screen.getByText(/Verified actuals: 3 bags · 8\.5 kg/)).toBeVisible();
    expect(screen.queryByText(/stops collected/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1 of 4 collected/)).not.toBeInTheDocument();
    expect(screen.queryByText(/3 left/)).not.toBeInTheDocument();
    // Thin progress bar and per-stop status chips stay as the progress signal.
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getAllByText('Collected').length).toBeGreaterThanOrEqual(1);
  });

  it('falls back to the DLN reference when the citizen name is blank', async () => {
    const collected: TextileCollectionListItem = {
      ...ITEM,
      status: 'picked_up',
      requester_name: '   ',
      actual_bags: 2,
      actual_weight_kg: 5,
      picked_up_at: '2026-08-27T10:30:00+05:30',
    };
    vi.mocked(fetchTextileDetail).mockResolvedValue(collected);
    vi.mocked(useTextileQueue).mockReturnValue({
      data: {
        data: [collected],
        meta: { page: 1, per_page: 25, total: 1, last_page: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTextileQueue>);
    renderStopPage();

    expect(
      await screen.findByRole('heading', { name: `${ITEM.reference} collected` }),
    ).toBeVisible();
  });

  it('shows a printable bag receipt QR after collection', async () => {
    const collected: TextileCollectionListItem = {
      ...ITEM,
      status: 'picked_up',
      actual_bags: 3,
      actual_weight_kg: 8.5,
      picked_up_at: '2026-08-27T10:30:00+05:30',
    };
    vi.mocked(fetchTextileDetail).mockResolvedValue(collected);
    vi.mocked(useTextileQueue).mockReturnValue({
      data: {
        data: [collected],
        meta: { page: 1, per_page: 25, total: 1, last_page: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTextileQueue>);
    renderStopPage();

    expect(await screen.findByRole('heading', { name: 'Lakshmi Devi collected' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Bag receipt' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Print bag label' })).toBeVisible();
  });

  it('shows a road route map with pins in visit order and no stop wording', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 'Ok',
            routes: [
              {
                geometry: {
                  coordinates: [
                    [77.59, 12.97],
                    [77.6, 12.98],
                  ],
                },
              },
            ],
          }),
      }),
    );
    const first: TextileCollectionListItem = {
      ...ITEM,
      status: 'picked_up',
      stop_order: 1,
      latitude: 12.97,
      longitude: 77.59,
    };
    const second: TextileCollectionListItem = {
      ...ITEM,
      id: 'collection-2',
      reference: 'DLN-2026-000002',
      requester_name: 'Neighbour 2',
      status: 'scheduled',
      stop_order: 2,
      latitude: 12.98,
      longitude: 77.6,
      actual_bags: null,
      actual_weight_kg: null,
      picked_up_at: null,
    };
    const third: TextileCollectionListItem = {
      ...ITEM,
      id: 'collection-3',
      reference: 'DLN-2026-000003',
      requester_name: 'Neighbour 3',
      status: 'scheduled',
      stop_order: 3,
      latitude: null,
      longitude: null,
      actual_bags: null,
      actual_weight_kg: null,
      picked_up_at: null,
    };
    vi.mocked(fetchTextileDetail).mockResolvedValue(second);
    vi.mocked(useTextileQueue).mockReturnValue({
      data: {
        // The queue can arrive in creation order; the page must use the
        // persisted optimized visit order from the API.
        data: [second, third, first],
        meta: { page: 1, per_page: 25, total: 3, last_page: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTextileQueue>);
    renderStopPage();

    expect(await screen.findByTestId('route-map')).toBeInTheDocument();
    expect(screen.getByText('Today’s collection route')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getAllByTestId('route-pin')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /Neighbour 2/ })).toHaveAttribute(
      'href',
      '/operations/textile-collections/collections/batch-1/stops/collection-2',
    );
    expect(screen.getByText(/1 collection cannot be placed on the map yet/)).toBeInTheDocument();
    expect(screen.queryByText(/without map coordinates/)).not.toBeInTheDocument();

    // Stop-to-stop navigation ribbon links
    const gpsLinks = screen.getAllByRole('link', { name: /Navigate with GPS/ });
    expect(gpsLinks).toHaveLength(3);
    expect(gpsLinks[0]).toHaveAttribute(
      'href',
      expect.stringContaining('https://www.google.com/maps/dir/'),
    );

    // Toggle road map visibility
    const mapToggleBtn = screen.getByRole('button', { name: /View road map/ });
    expect(mapToggleBtn).toBeInTheDocument();
    fireEvent.click(mapToggleBtn);
    expect(screen.getByRole('button', { name: /Hide map/ })).toBeInTheDocument();

    // No stop wording anywhere on the page.
    expect(screen.queryByText(/Collection stop/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Route Itinerary/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Stop #/)).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
