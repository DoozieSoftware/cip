import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { TextileCollectionFields } from '../TextileCollectionFields';
import { useTextileServiceZones } from '../../api/textileZones';
import { useCitizenContactProfile } from '../../api/profile';

vi.mock('../../api/textileZones', () => ({
  useTextileServiceZones: vi.fn(),
}));

vi.mock('../../api/profile', () => ({
  useCitizenContactProfile: vi.fn(),
}));

const mockUseTextileServiceZones = useTextileServiceZones as Mock;
const mockUseCitizenContactProfile = useCitizenContactProfile as Mock;

function mockZones(data: unknown[], isLoading = false, isError = false) {
  mockUseTextileServiceZones.mockReturnValue({
    data,
    isLoading,
    isError,
    refetch: vi.fn(),
  });
}

function mockProfile(
  contact: {
    name: string;
    email: string;
    phone: string;
    defaultAddress: string;
  } | null,
) {
  mockUseCitizenContactProfile.mockReturnValue({
    data: contact,
    isLoading: false,
    isError: false,
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
  mockProfile(null);
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

  it('reports the zone drop-off point upward when Drop at center is selected', async () => {
    mockZones([ZONE_A]);
    const onDropoffChange = vi.fn();
    render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
        onDropoffChange={onDropoffChange}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('radio', { name: /Drop at center/ }));
    // The drop-off card (name, address, map, Maps link) now renders in
    // TextileRequestPage, so this component's job is to report it upward.
    await waitFor(() => {
      expect(onDropoffChange).toHaveBeenCalledWith({
        name: 'Drop A',
        address: '100 Main St',
        center: null,
      });
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
    expect(screen.queryByLabelText(/Apartment \/ community name/)).toBeNull();
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
      expect(screen.getByLabelText(/Apartment \/ community name/)).toBeDefined();
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
    const emailInput = screen.getByLabelText(/Email \(for receipt\)/);
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
    const dropoffLabel = screen.getByRole('radio', { name: /Drop at center/ }).closest('label');
    expect(dropoffLabel?.querySelector('input[type="radio"]')).toHaveAttribute('disabled');
  });

  it('displays inline warning and aria-invalid when entered weight is below pickup minimum', async () => {
    mockZones([ZONE_A]);
    render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
        minimum={{
          service_zone_id: 'zone-a',
          min_bags: null,
          min_weight_kg: 4,
          guidance_text: null,
        }}
      />,
      { wrapper },
    );

    // Switch to premises (pickup from location)
    fireEvent.click(screen.getByText('Pick up from location'));

    // Enter 3 kg (below minimum of 4 kg)
    const weightInput = screen.getByLabelText('About how many kg?');
    fireEvent.change(weightInput, { target: { value: '3' } });

    await waitFor(() => {
      expect(screen.getByText(/Below the pickup minimum/)).toBeDefined();
      expect(screen.getAllByText(/Home pickup needs at least 4 kg/).length).toBeGreaterThan(0);
      expect(weightInput).toHaveAttribute('aria-invalid', 'true');
    });

    // Click "switch to centre drop-off" button inside warning
    const switchBtn = screen.getByRole('button', { name: /switch to centre drop-off/i });
    fireEvent.click(switchBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Below the pickup minimum/)).toBeNull();
      expect(weightInput).toHaveAttribute('aria-invalid', 'false');
    });
  });

  it('lets any bag count pass the pickup minimum (weight-only rule)', async () => {
    mockZones([ZONE_A]);
    render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
        minimum={{
          service_zone_id: 'zone-a',
          min_bags: 50,
          min_weight_kg: 4,
          guidance_text: null,
        }}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByText('Pick up from location'));

    // A single bag would fail the old bags rule but must not warn now.
    const bagsInput = screen.getByLabelText('How many bags?');
    fireEvent.change(bagsInput, { target: { value: '1' } });

    await waitFor(() => {
      expect(bagsInput).toHaveAttribute('aria-invalid', 'false');
    });
    expect(screen.queryByText(/Below the pickup minimum/)).toBeNull();
  });

  it('ignores a decimal typed into the kilogram field instead of storing it', () => {
    mockZones([ZONE_A]);
    render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
        minimum={null}
      />,
      { wrapper },
    );

    const weightInput = screen.getByLabelText('About how many kg?');
    fireEvent.change(weightInput, { target: { value: '4' } });
    expect(weightInput).toHaveValue('4');

    // A decimal keystroke/paste must be rejected outright, not accepted then
    // flagged: the value stays at the last valid integer.
    fireEvent.change(weightInput, { target: { value: '4.5' } });
    expect(weightInput).toHaveValue('4');
    expect(weightInput).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText(/whole kg \(no decimals\)/)).toBeNull();
  });

  it('uses digits-only integer inputs for bags and kg', () => {
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

    const bagsInput = screen.getByLabelText('How many bags?');
    expect(bagsInput).toHaveAttribute('inputmode', 'numeric');
    expect(bagsInput).toHaveAttribute('pattern', '[0-9]*');
    const weightInput = screen.getByLabelText('About how many kg?');
    expect(weightInput).toHaveAttribute('inputmode', 'numeric');
    expect(weightInput).toHaveAttribute('pattern', '[0-9]*');
  });

  it('hides the address field for drop-off and shows it for pickup from location', async () => {
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

    // Zone A defaults to drop-off: no address field.
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /Drop at center/ })).toBeDefined();
    });
    expect(screen.queryByLabelText('Pickup address')).toBeNull();

    // Switch to pickup: address appears.
    fireEvent.click(screen.getByText('Pick up from location'));
    await waitFor(() => {
      expect(screen.getByLabelText('Pickup address')).toBeDefined();
    });

    // Switch back to drop-off: address hides again.
    fireEvent.click(screen.getByText('Drop at center'));
    await waitFor(() => {
      expect(screen.queryByLabelText('Pickup address')).toBeNull();
    });
  });

  it('reports an empty pickup address for drop-off bookings', async () => {
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

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Asha Rao' } });
    fireEvent.change(screen.getByLabelText(/Email \(for receipt\)/), {
      target: { value: 'asha@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Phone \(for pickup updates\)/), {
      target: { value: '+91 9876543210' },
    });
    fireEvent.change(screen.getByLabelText('How many bags?'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('Pick up from location'));
    const addressInput = await screen.findByLabelText('Pickup address');
    fireEvent.change(addressInput, { target: { value: '12, MG Road, Bengaluru 560001' } });

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ pickup_address: '12, MG Road, Bengaluru 560001' }),
      );
    });

    fireEvent.click(screen.getByText('Drop at center'));

    // Drop-off must not carry personal address data upward.
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ pickup_address: '' }));
    });
  });

  it('pre-fills name, email, phone, and address from the citizen profile', async () => {
    mockZones([ZONE_A]);
    mockProfile({
      name: 'Asha Rao',
      email: 'asha@example.com',
      phone: '+91 9876543210',
      defaultAddress: '12, MG Road, Bengaluru 560001',
    });
    render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
      />,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Your name')).toHaveValue('Asha Rao');
    });
    expect(screen.getByLabelText(/Email \(for receipt\)/)).toHaveValue('asha@example.com');
    expect(screen.getByLabelText(/Phone \(for pickup updates\)/)).toHaveValue('+91 9876543210');

    // Address pre-fill is visible once pickup from location is selected.
    fireEvent.click(screen.getByText('Pick up from location'));
    await waitFor(() => {
      expect(screen.getByLabelText('Pickup address')).toHaveValue('12, MG Road, Bengaluru 560001');
    });
  });

  it('does not overwrite citizen-typed contact fields with the profile', async () => {
    mockZones([ZONE_A]);
    function renderFields() {
      return (
        <TextileCollectionFields
          category="clothes_waste"
          value={null}
          onChange={vi.fn()}
          onValidityChange={vi.fn()}
        />
      );
    }
    const { rerender } = render(renderFields(), { wrapper });

    // Citizen types before the profile arrives.
    const nameInput = screen.getByLabelText('Your name');
    fireEvent.change(nameInput, { target: { value: 'Typed Name' } });

    mockProfile({
      name: 'Asha Rao',
      email: 'asha@example.com',
      phone: '+91 9876543210',
      defaultAddress: '12, MG Road, Bengaluru 560001',
    });
    // Fresh element so React re-renders and picks up the loaded profile.
    rerender(renderFields());

    await waitFor(() => {
      expect(screen.getByLabelText(/Email \(for receipt\)/)).toHaveValue('asha@example.com');
    });
    expect(screen.getByLabelText('Your name')).toHaveValue('Typed Name');
  });

  it('dynamically selects the zone when zones finish loading asynchronously', async () => {
    mockZones([], true);
    const onDraftChange = vi.fn();
    const { rerender } = render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
        onDraftChange={onDraftChange}
      />,
      { wrapper },
    );

    expect(screen.getByText(/Loading service zones/)).toBeDefined();

    mockZones([ZONE_A]);
    rerender(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
        onDraftChange={onDraftChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Service zone')).toHaveValue('zone-a');
    });
  });

  it('dynamically switches zone when category changes to one with different zones', async () => {
    const ZONE_METAL = {
      id: 'zone-metal-1',
      code: 'MTL-1',
      name: 'Metal Scrap Zone',
      center: null,
      service_radius_km: 10,
      methods: ['premises'],
      dropoff: null,
      readiness_instructions: null,
      partner: null,
    };

    mockZones([ZONE_A]);
    const onDraftChange = vi.fn();
    const { rerender } = render(
      <TextileCollectionFields
        category="clothes_waste"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
        onDraftChange={onDraftChange}
      />,
      { wrapper },
    );

    expect(screen.getByLabelText('Service zone')).toHaveValue('zone-a');

    mockZones([ZONE_METAL]);
    rerender(
      <TextileCollectionFields
        category="metal_scrap"
        value={null}
        onChange={vi.fn()}
        onValidityChange={vi.fn()}
        onDraftChange={onDraftChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Service zone')).toHaveValue('zone-metal-1');
    });
  });
});
