import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LocationMap from './LocationMap';

vi.mock('../../../shared/geo/useReverseGeocode', () => ({
  useReverseGeocode: () => 'MG Road, Bengaluru',
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('LocationMap accessibility', () => {
  it('exposes the map as a labelled img role with coordinates in the description', () => {
    render(<LocationMap latitude={12.9716} longitude={77.5946} />);
    const mapRegion = screen.getByRole('img', { name: /map showing report location/i });
    expect(mapRegion).toBeInTheDocument();
    expect(mapRegion.getAttribute('aria-label')).toContain('12.9716');
    expect(mapRegion.getAttribute('aria-label')).toContain('77.5946');
  });

  it('renders the place label as visible text', () => {
    render(<LocationMap latitude={12.9716} longitude={77.5946} />);
    const labels = screen.getAllByText(/MG Road, Bengaluru/);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some((el) => el.tagName === 'SPAN')).toBe(true);
  });
});
