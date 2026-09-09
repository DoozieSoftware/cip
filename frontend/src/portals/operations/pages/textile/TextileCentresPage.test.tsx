import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type * as TextileShared from './shared';
import TextileCentresPage from './TextileCentresPage';
import { useDesk } from './shared';
import * as textileApi from '../../api/textileApi';
import type { StaffTextileZone } from '../../api/textileApi';
import { forwardGeocode } from '../../../../shared/geo/forwardGeocode';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="centre-map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => <div data-testid="centre-marker" />,
  useMap: () => ({ setView: vi.fn() }),
  useMapEvents: () => null,
}));

vi.mock('../../../../shared/geo/forwardGeocode', () => ({
  forwardGeocode: vi.fn(),
}));

vi.mock('./shared', async () => {
  const actual = await vi.importActual<typeof TextileShared>('./shared');
  return { ...actual, useDesk: vi.fn() };
});

vi.mock('../../api/textileApi', async () => {
  const actual = await vi.importActual<typeof textileApi>('../../api/textileApi');
  return {
    ...actual,
    fetchStaffTextileZones: vi.fn(),
    createStaffTextileZone: vi.fn(),
    updateStaffTextileZone: vi.fn(),
    createZoneCentre: vi.fn(),
    updateZoneCentre: vi.fn(),
  };
});

const mockedDesk = vi.mocked(useDesk);
const fetchZones = vi.mocked(textileApi.fetchStaffTextileZones);
const createZone = vi.mocked(textileApi.createStaffTextileZone);
const createCentre = vi.mocked(textileApi.createZoneCentre);
const updateCentre = vi.mocked(textileApi.updateZoneCentre);
const findAddress = vi.mocked(forwardGeocode);

const ZONE: StaffTextileZone = {
  id: 'zone-1',
  code: 'JAYANAGAR',
  name: 'Jayanagar',
  methods: ['dropoff', 'premises'],
  active: true,
  centres: [
    {
      id: 'centre-1',
      service_zone_id: 'zone-1',
      name: '4th Block centre',
      address: '11, 4th Block',
      latitude: 12.9716,
      longitude: 77.5946,
      operating_hours: null,
      public_phone: null,
      status: 'open',
      closed_note: null,
      active: true,
      sort_order: 0,
    },
  ],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <TextileCentresPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedDesk.mockReturnValue({ ready: true, isDrLinen: true, departmentId: 'dept-1' });
  fetchZones.mockResolvedValue([ZONE]);
  findAddress.mockResolvedValue({
    label: 'Jayanagar, Bengaluru',
    latitude: 12.9352,
    longitude: 77.6245,
    geocoded: true,
  });
  createZone.mockResolvedValue({
    ...ZONE,
    id: 'zone-2',
    code: 'NEW',
    name: 'New Zone',
    centres: [],
  });
  createCentre.mockResolvedValue({
    id: 'centre-2',
    service_zone_id: 'zone-1',
    name: 'New centre',
    address: null,
    latitude: null,
    longitude: null,
    operating_hours: null,
    public_phone: null,
    status: 'open',
    closed_note: null,
    active: true,
    sort_order: 0,
  });
  updateCentre.mockImplementation((id, payload) =>
    Promise.resolve({
      id,
      service_zone_id: 'zone-1',
      name: typeof payload.name === 'string' ? payload.name : '4th Block centre',
      address: null,
      latitude: null,
      longitude: null,
      operating_hours: null,
      public_phone: null,
      status: 'open',
      closed_note: null,
      active: true,
      sort_order: 0,
    }),
  );
});

describe('TextileCentresPage', () => {
  it('lists zones and their centres', async () => {
    renderPage();
    expect(await screen.findByText('4th Block centre')).toBeInTheDocument();
    expect(screen.getByText('11, 4th Block')).toBeInTheDocument();
    expect(fetchZones).toHaveBeenCalledWith('dept-1');
  });

  it('shows an empty state when the partner has no zones', async () => {
    fetchZones.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No service zones yet')).toBeInTheDocument();
  });

  it('shows an error state with retry when zones fail to load', async () => {
    fetchZones.mockRejectedValue(new Error('offline'));
    renderPage();
    expect(await screen.findByText('Could not load requests')).toBeInTheDocument();
  });

  it('creates a centre for the selected zone', async () => {
    renderPage();
    expect(await screen.findByText('4th Block centre')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add centre/i }));
    fireEvent.change(screen.getByLabelText('Centre name'), {
      target: { value: 'New centre' },
    });
    fireEvent.change(screen.getByLabelText('Address'), {
      target: { value: 'Jayanagar, Bengaluru' },
    });
    fireEvent.click(screen.getByRole('button', { name: /find on map/i }));
    await screen.findByText(/Found: Jayanagar, Bengaluru/);
    fireEvent.click(screen.getByRole('button', { name: /create centre/i }));

    await waitFor(() =>
      expect(createCentre).toHaveBeenCalledWith(
        'zone-1',
        expect.objectContaining({ name: 'New centre' }),
        'dept-1',
      ),
    );
  });

  it('edits an existing centre', async () => {
    renderPage();
    expect(await screen.findByText('4th Block centre')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    const nameInput = screen.getByLabelText('Centre name');
    expect(nameInput).toHaveValue('4th Block centre');
    fireEvent.change(nameInput, { target: { value: 'Renamed centre' } });
    fireEvent.click(screen.getByRole('button', { name: /save centre/i }));

    await waitFor(() =>
      expect(updateCentre).toHaveBeenCalledWith(
        'centre-1',
        expect.objectContaining({ name: 'Renamed centre' }),
        'dept-1',
      ),
    );
  });

  it('shows the pinned coordinates with a directions link', async () => {
    renderPage();
    expect(await screen.findByText('4th Block centre')).toBeInTheDocument();
    expect(screen.getByText(/12\.9716/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Directions' })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=12.9716,77.5946',
    );
  });

  it('sends the typed pin coordinates when creating a centre', async () => {
    renderPage();
    expect(await screen.findByText('4th Block centre')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add centre/i }));
    fireEvent.change(screen.getByLabelText('Centre name'), {
      target: { value: 'Pinned centre' },
    });
    fireEvent.change(screen.getByLabelText('Address'), {
      target: { value: 'Jayanagar, Bengaluru' },
    });
    fireEvent.click(screen.getByRole('button', { name: /find on map/i }));
    await screen.findByText(/Found: Jayanagar, Bengaluru/);
    fireEvent.click(screen.getByRole('button', { name: /create centre/i }));

    await waitFor(() =>
      expect(createCentre).toHaveBeenCalledWith(
        'zone-1',
        expect.objectContaining({ name: 'Pinned centre', latitude: 12.9352, longitude: 77.6245 }),
        'dept-1',
      ),
    );
  });
});
