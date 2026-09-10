import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TextileCentreSelect } from './TextileCentreSelect';
import type { TextileDropoffCentreInfo } from '../api/textileZones';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="centre-map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({ eventHandlers }: { eventHandlers?: { click?: () => void } }) => (
    <button type="button" data-testid="centre-pin" onClick={() => eventHandlers?.click?.()}>
      pin
    </button>
  ),
}));

function centre(overrides: Partial<TextileDropoffCentreInfo> = {}): TextileDropoffCentreInfo {
  return {
    id: 'centre-1',
    service_zone_id: 'zone-1',
    name: '4th Block centre',
    address: '11, 4th Block, Jayanagar',
    latitude: 12.9352,
    longitude: 77.6245,
    operating_hours: null,
    public_phone: '+91 80 4111 2222',
    status: 'open',
    closed_note: null,
    active: true,
    sort_order: 0,
    ...overrides,
  };
}

describe('TextileCentreSelect', () => {
  it('shows the auto-select hint when provided', () => {
    render(
      <TextileCentreSelect
        centres={[centre(), centre({ id: 'centre-2', name: 'South centre' })]}
        value="centre-1"
        onChange={vi.fn()}
        hint="Auto-selected to nearest — change if needed. Nearest to: JP Nagar."
      />,
    );

    expect(screen.getByText(/Auto-selected to nearest/)).toBeInTheDocument();
  });

  it('renders a zone-driven dropdown of open centres with the chosen address', () => {
    const onChange = vi.fn();
    render(
      <TextileCentreSelect
        centres={[centre(), centre({ id: 'centre-2', name: 'South centre', address: null })]}
        value="centre-1"
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText('Drop-off centre')).toHaveValue('centre-1');
    expect(screen.getByText(/11, 4th Block, Jayanagar/)).toBeInTheDocument();
    expect(screen.getByTestId('centre-map')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Drop-off centre'), {
      target: { value: 'centre-2' },
    });
    expect(onChange).toHaveBeenCalledWith('centre-2');
  });

  it('selects a centre by tapping its map pin', () => {
    const onChange = vi.fn();
    render(<TextileCentreSelect centres={[centre()]} value="" onChange={onChange} />);

    fireEvent.click(screen.getByTestId('centre-pin'));
    expect(onChange).toHaveBeenCalledWith('centre-1');
  });

  it('lists unpinned centres in the dropdown with a coming-soon note', () => {
    render(
      <TextileCentreSelect
        centres={[centre({ latitude: null, longitude: null })]}
        value=""
        onChange={() => {}}
      />,
    );

    expect(screen.queryByTestId('centre-map')).not.toBeInTheDocument();
    expect(screen.getByText(/pins coming soon/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '4th Block centre' })).toBeInTheDocument();
  });

  it('hides closed and unlisted centres instead of offering them', () => {
    render(
      <TextileCentreSelect
        centres={[
          centre({ id: 'c-closed', name: 'Closed', status: 'temporarily_closed' }),
          centre({ id: 'c-hidden', name: 'Hidden', active: false }),
        ]}
        value=""
        onChange={() => {}}
      />,
    );

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText(/no separate drop-off centre/i)).toBeInTheDocument();
  });

  it('shows validation errors for screen readers', () => {
    render(
      <TextileCentreSelect
        centres={[centre()]}
        value=""
        onChange={() => {}}
        error="Pick a centre."
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a centre.');
  });
});
