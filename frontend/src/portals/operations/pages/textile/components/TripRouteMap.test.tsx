import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TextileCollectionListItem } from '../../../api/textileApi';
import TripRouteMap from './TripRouteMap';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="route-map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({
    children,
    icon,
  }: {
    children?: React.ReactNode;
    icon?: { options?: { html?: string } };
  }) => (
    <div data-testid="route-pin" data-icon-html={icon?.options?.html ?? ''}>
      {children}
    </div>
  ),
  Polyline: () => <div data-testid="route-path" />,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn() }),
}));

function item(
  overrides: Partial<TextileCollectionListItem> & { id: string },
): TextileCollectionListItem {
  return {
    reference: `DLN-${overrides.id}`,
    title: 'Textile pickup',
    notes: null,
    status: 'scheduled',
    requester_type: 'individual',
    requester_name: `Customer ${overrides.id}`,
    rwa_name: null,
    contact_email: 'customer@example.test',
    contact_phone: '+91 9876543210',
    pickup_address: `${overrides.id} Main St, Bengaluru`,
    collection_method: 'premises',
    estimated_bags: 2,
    estimated_weight_kg: 5,
    actual_bags: null,
    actual_weight_kg: null,
    scheduled_date: '2026-08-27',
    scheduled_window_start: null,
    scheduled_window_end: null,
    readiness_instructions: null,
    rejection_reason: null,
    missed_pickup_reason: null,
    picked_up_at: null,
    service_zone: null,
    batch: null,
    submitted_at: null,
    photos: [],
    category: 'clothes_waste',
    partner: null,
    ...overrides,
  };
}

function renderMap(items: TextileCollectionListItem[]) {
  render(
    <MemoryRouter>
      <TripRouteMap items={items} tripId="batch-1" />
    </MemoryRouter>,
  );
}

describe('TripRouteMap', () => {
  it('renders numbered pins in manifest order with a connecting path', () => {
    renderMap([
      item({ id: 'c1', latitude: 12.9716, longitude: 77.5946 }),
      item({ id: 'c2', latitude: 12.975, longitude: 77.6 }),
      item({ id: 'c3', latitude: 12.98, longitude: 77.61 }),
    ]);

    expect(screen.getByTestId('route-map')).toBeInTheDocument();
    expect(screen.getByTestId('route-path')).toBeInTheDocument();

    const pins = screen.getAllByTestId('route-pin');
    expect(pins).toHaveLength(3);
    const numbers = pins.map((pin) => pin.getAttribute('data-icon-html'));
    expect(numbers[0]).toContain('>1<');
    expect(numbers[1]).toContain('>2<');
    expect(numbers[2]).toContain('>3<');

    // Popups keep manifest sequence labels.
    expect(screen.getByText(/Stop 1: Customer c1/)).toBeInTheDocument();
    expect(screen.getByText(/Stop 3: Customer c3/)).toBeInTheDocument();
  });

  it('highlights the next pending stop pin distinctly', () => {
    renderMap([
      item({ id: 'c1', status: 'picked_up', latitude: 12.9716, longitude: 77.5946 }),
      item({ id: 'c2', status: 'scheduled', latitude: 12.975, longitude: 77.6 }),
    ]);

    const pins = screen.getAllByTestId('route-pin');
    // Collected pin uses the success tone, next pending pin the warning tone.
    expect(pins[0].getAttribute('data-icon-html')).toContain('#226b46');
    expect(pins[1].getAttribute('data-icon-html')).toContain('#b45309');
    expect(screen.getByText(/Stop 2: Customer c2 · Next stop/)).toBeInTheDocument();
  });

  it('lists stops without coordinates beneath the map in sequence', () => {
    renderMap([
      item({ id: 'c1', latitude: 12.9716, longitude: 77.5946 }),
      item({ id: 'c2' }),
      item({ id: 'c3', latitude: 12.98, longitude: 77.61 }),
    ]);

    expect(screen.getAllByTestId('route-pin')).toHaveLength(2);
    // Two mapped stops still connect with a path; the unmapped stop is listed.
    expect(screen.queryByTestId('route-path')).toBeInTheDocument();

    const unmapped = screen.getByText(/Stops without map coordinates \(1\)/);
    const group = unmapped.closest('div')?.parentElement ?? document.body;
    expect(within(group).getByText(/Stop 2: Customer c2/)).toBeInTheDocument();
  });

  it('omits the polyline for a single mapped stop and notes offline truth', () => {
    renderMap([item({ id: 'c1', latitude: 12.9716, longitude: 77.5946 })]);

    expect(screen.getByTestId('route-map')).toBeInTheDocument();
    expect(screen.queryByTestId('route-path')).not.toBeInTheDocument();
    expect(screen.getByText(/source of truth/)).toBeInTheDocument();
  });

  it('renders nothing for an empty manifest', () => {
    const { container } = render(
      <MemoryRouter>
        <TripRouteMap items={[]} tripId="batch-1" />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
