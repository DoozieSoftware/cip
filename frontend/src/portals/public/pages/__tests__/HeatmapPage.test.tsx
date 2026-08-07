import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api/client', () => ({
  usePublicHeatmap: vi.fn(),
}));

vi.mock('../../moderator/design', () => ({
  Spinner: ({ label }: { label?: string }) => <div data-testid="spinner">{label}</div>,
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <div data-testid="empty-state">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  ),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  CircleMarker: () => null,
  Popup: () => null,
}));

const { usePublicHeatmap } = await import('../api/client');
const HeatmapPage = (await import('../HeatmapPage')).default;

describe('Public HeatmapPage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (usePublicHeatmap as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        { lat: 12.97, lng: 77.59, count: 5 },
        { lat: 12.98, lng: 77.6, count: 3 },
      ],
      isLoading: false,
      isError: false,
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <HeatmapPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Report density')).toBeTruthy();
  });

  it('renders the map when data is loaded', async () => {
    render(
      <QueryClientProvider client={client}>
        <HeatmapPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId('map')).toBeTruthy();
  });

  it('shows loading state while fetching', () => {
    (usePublicHeatmap as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    render(
      <QueryClientProvider client={client}>
        <HeatmapPage />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading heat map')).toBeTruthy();
  });

  it('shows error state on failure', async () => {
    (usePublicHeatmap as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    render(
      <QueryClientProvider client={client}>
        <HeatmapPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Heat map unavailable')).toBeTruthy();
  });

  it('shows empty state when no reports exist', async () => {
    (usePublicHeatmap as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    render(
      <QueryClientProvider client={client}>
        <HeatmapPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('No reports yet')).toBeTruthy();
  });
});
