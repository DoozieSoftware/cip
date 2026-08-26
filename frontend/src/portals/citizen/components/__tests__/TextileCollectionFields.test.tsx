import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { TextileCollectionFields } from '../TextileCollectionFields';
import { useTextileServiceZones } from '../../api/textileZones';

vi.mock('../../api/textileZones', () => ({
  useTextileServiceZones: vi.fn(),
}));

const mockUseTextileServiceZones = useTextileServiceZones as Mock;

function mockZones(data: unknown[], isLoading = false, isError = false) {
  mockUseTextileServiceZones.mockReturnValue({
    data,
    isLoading,
    isError,
    refetch: vi.fn(),
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const ZONE_A = {
  id: 'zone-a',
  code: 'DRL-A',
  name: 'Zone A',
  center: null,
  service_radius_km: 10,
  methods: ['dropoff', 'premises'],
  dropoff: { name: 'Drop A', address: '100 Main St' },
  readiness_instructions: 'Pack dry.',
  partner: { id: 'p-1', name: 'Dr. Linen' },
};

const ZONE_B_NO_DROPOFF = {
  id: 'zone-b',
  code: 'DRL-B',
  name: 'Zone B',
  center: null,
  service_radius_km: 10,
  methods: ['premises'],
  dropoff: null,
  readiness_instructions: null,
  partner: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TextileCollectionFields', () => {
  it('renders the form for any supported category', () => {
    mockZones([ZONE_A]);
    render(
      <TextileCollectionFields
        category="metal_scrap"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
      { wrapper },
    );
    expect(screen.getByText('Zone A')).toBeDefined();
    expect(screen.getByText('Individual')).toBeDefined();
  });

  it('renders the zone selector and requester-type toggle for clothes_waste', () => {
    mockZones([ZONE_A]);
    render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
      { wrapper },
    );
    expect(screen.getByText('Zone A')).toBeDefined();
    expect(screen.getByText('Individual')).toBeDefined();
    expect(screen.getByText('RWA / Community')).toBeDefined();
  });

  it('shows loading state while zones are loading', () => {
    mockZones([], true);
    render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
      { wrapper },
    );
    expect(screen.getByText(/Loading service zones/)).toBeDefined();
  });

  it('shows error state when zones fail to load', () => {
    mockZones([], false, true);
    render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
      { wrapper },
    );
    expect(screen.getByText(/Could not load service zones/)).toBeDefined();
  });

  it('shows empty state when no zones exist', () => {
    mockZones([]);
    render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
      { wrapper },
    );
    expect(screen.getByText(/No collection partner is serving your area/)).toBeDefined();
  });

  it('shows dropoff hint when collection_method is dropoff and zone has dropoff block', async () => {
    mockZones([ZONE_A]);
    render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByText('Drop-off'));
    await waitFor(() => {
      expect(screen.getByText(/Drop-off point/)).toBeDefined();
      expect(screen.getByText(/Drop A/)).toBeDefined();
      expect(screen.getByText(/100 Main St/)).toBeDefined();
    });
  });

  it('hides the RWA name field when requester_type is individual', () => {
    mockZones([ZONE_A]);
    render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
      { wrapper },
    );
    expect(screen.queryByLabelText(/RWA \/ community name/)).toBeNull();
  });

  it('shows the RWA name field when requester_type is rwa', async () => {
    mockZones([ZONE_A]);
    render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByText('RWA / Community'));
    await waitFor(() => {
      expect(screen.getByLabelText(/RWA \/ community name/)).toBeDefined();
    });
  });

  it('calls onValidityChange with false when required fields are empty', async () => {
    mockZones([ZONE_A]);
    const onValidityChange = vi.fn();
    render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
      />,
      { wrapper },
    );
    await waitFor(() => {
      expect(onValidityChange).toHaveBeenLastCalledWith(false);
    });
  });

  it('calls onChange with null when email is malformed', async () => {
    mockZones([ZONE_A]);
    const onChange = vi.fn();
    render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={onChange}
        onValidityChange={vi.fn()}
      />,
      { wrapper },
    );
    const emailInput = screen.getByLabelText(/Contact email/);
    fireEvent.change(emailInput, { target: { value: 'bad-email' } });
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(null);
    });
  });

  it('disables the dropoff method for a zone that does not offer it', () => {
    mockZones([ZONE_B_NO_DROPOFF]);
    render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
      { wrapper },
    );
    const dropoffLabel = screen.getByText('Drop-off').closest('label');
    expect(dropoffLabel?.querySelector('input[type="radio"]')).toHaveAttribute('disabled');
  });
});
