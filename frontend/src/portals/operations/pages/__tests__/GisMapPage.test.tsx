import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/operations', () => ({
  departmentApi: {
    listReports: vi.fn(),
  },
}));

vi.mock('../context/DepartmentSelectionContext', () => ({
  useDepartmentSelection: vi.fn(() => ({
    selectedId: 'dept-1',
    ready: true,
    memberships: [{ id: 'dept-1', name: 'BBMP', code: 'bbmp' }],
    select: vi.fn(),
  })),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => null,
  Popup: () => null,
}));

const { departmentApi } = await import('../api/operations');
const GisMapPage = (await import('../GisMapPage')).default;

describe('GisMapPage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (departmentApi.listReports as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          id: 'r-1',
          tracking_number: 'CIP-001',
          title: 'Pothole',
          current_status_code: 'assigned',
          report_type: { code: 'roads', name: 'Roads' },
          submitted_at: '2026-01-01T00:00:00Z',
          priority: { code: 'medium', name: 'Medium' },
          location: { lat: 12.97, lng: 77.59 },
          assignment: null,
          department_sla_minutes: 240,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <GisMapPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('GIS map')).toBeTruthy();
  });

  it('renders the map', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <GisMapPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId('map')).toBeTruthy();
  });

  it('shows loading state', () => {
    (departmentApi.listReports as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <GisMapPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading map data')).toBeTruthy();
  });

  it('shows error state', async () => {
    (departmentApi.listReports as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('fail'),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <GisMapPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Could not load reports')).toBeTruthy();
  });

  it('shows empty state when no points on map', async () => {
    (departmentApi.listReports as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <GisMapPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('No reports on the map')).toBeTruthy();
  });
});
