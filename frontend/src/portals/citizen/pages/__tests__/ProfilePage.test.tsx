import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { reverseGeocode } from '../../../../shared/geo/reverseGeocode';

vi.mock('../../../../auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'u-1', name: 'John Doe', mobile: '+919999999999' },
    token: 'mock-token',
    isAuthenticated: true,
    hasAnyRole: vi.fn(() => false),
    logout: vi.fn(),
    login: vi.fn(),
    loading: false,
  })),
}));

vi.mock('../../../../auth/api', () => ({
  apiRequest: vi.fn(),
  ApiEnvelope: {},
}));

vi.mock('../../../../shared/geo/reverseGeocode', () => ({
  reverseGeocode: vi.fn(),
}));

const { apiRequest } = await import('../../../../auth/api');
const ProfilePage = (await import('../ProfilePage')).default;

describe('ProfilePage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        id: 'u-1',
        name: 'John Doe',
        mobile: '+919999999999',
        email: 'john@example.com',
        roles: ['citizen'],
      },
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Profile')).toBeTruthy();
  });

  it('renders personal information', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Personal Information')).toBeTruthy();
    // Labels repeat between the edit form and the read-only summary rows.
    expect(screen.getAllByText('Full name').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mobile number').length).toBeGreaterThan(0);
  });

  it('renders contact section', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Contact')).toBeTruthy();
    expect(screen.getByText('Email address')).toBeTruthy();
  });

  it('renders access roles', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Access Roles')).toBeTruthy();
    expect(screen.getByText('citizen')).toBeTruthy();
  });

  it('keeps notification and legal settings in the Account page', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Push notifications')).toBeTruthy();
    expect(screen.getByText('Privacy & legal')).toBeTruthy();
    expect(screen.getByText('Privacy policy')).toBeTruthy();
    expect(screen.getByText('Terms of use')).toBeTruthy();
  });

  it('allows saving language and channel without a preferred name', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Regression: an empty preferred name must not block saving language
    // choices — the mock profile has no preferred_name and the Save button
    // used to stay disabled until one was typed.
    const saveButton = await screen.findByRole('button', { name: 'Save profile' });
    expect(saveButton).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'kn-IN' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      const call = (apiRequest as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
        ([url, opts]) =>
          url === '/auth/profile' && (opts as { method?: string } | undefined)?.method === 'PATCH',
      );
      expect(call).toBeDefined();
      expect((call![1] as { body: Record<string, unknown> }).body).toMatchObject({
        preferred_name: null,
        preferred_locale: 'kn-IN',
      });
    });
  });

  it('shows loading state', () => {
    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('status', { name: 'Loading profile' })).toBeTruthy();
  });

  it('shows error state when API fails', async () => {
    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error'),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Couldn't load profile")).toBeTruthy();
    expect(screen.getByText('Please check your connection and try again.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('retry button in error state calls refetch', async () => {
    (apiRequest as unknown as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        data: {
          id: 'u-1',
          name: 'John Doe',
          mobile: '+919999999999',
          email: 'john@example.com',
          roles: ['citizen'],
        },
      });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const retryButton = await screen.findByRole('button', { name: 'Retry' });
    fireEvent.click(retryButton);
    expect(await screen.findByText('Personal Information')).toBeTruthy();
  });

  it('shows empty state when no profile data returned', async () => {
    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('No profile data')).toBeTruthy();
    expect(screen.getByText('Your account information could not be found.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('renders editable contact fields pre-filled from the profile', async () => {
    window.localStorage.setItem('cip.citizen.defaultAddress.v1', '12, MG Road, Bengaluru 560001');
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByLabelText('Full name')).toHaveValue('John Doe');
    expect(screen.getByLabelText('Mobile number')).toHaveValue('+919999999999');
    expect(screen.getByLabelText(/Default address/)).toHaveValue('12, MG Road, Bengaluru 560001');
    window.localStorage.removeItem('cip.citizen.defaultAddress.v1');
  });

  it('saves name, phone, and default address with the profile', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const saveButton = await screen.findByRole('button', { name: 'Save profile' });
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Asha Rao' } });
    fireEvent.change(screen.getByLabelText('Mobile number'), {
      target: { value: '+91 98765 43210' },
    });
    fireEvent.change(screen.getByLabelText(/Default address/), {
      target: { value: '12, MG Road, Bengaluru 560001' },
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      const call = (apiRequest as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
        ([url, opts]) =>
          url === '/auth/profile' && (opts as { method?: string } | undefined)?.method === 'PATCH',
      );
      expect(call).toBeDefined();
      expect((call![1] as { body: Record<string, unknown> }).body).toMatchObject({
        name: 'Asha Rao',
        mobile: '+91 98765 43210',
        default_address: '12, MG Road, Bengaluru 560001',
      });
    });
    expect(window.localStorage.getItem('cip.citizen.defaultAddress.v1')).toBe(
      '12, MG Road, Bengaluru 560001',
    );
    window.localStorage.removeItem('cip.citizen.defaultAddress.v1');
  });

  it('blocks save and shows inline errors for invalid contact fields', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const saveButton = await screen.findByRole('button', { name: 'Save profile' });
    fireEvent.change(screen.getByLabelText('Email for notifications (Optional)'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText(/Default address/), { target: { value: 'short' } });
    fireEvent.click(saveButton);

    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByText('Enter a valid phone (8-20 digits, spaces allowed).')).toBeTruthy();
    expect(
      screen.getByText('Enter your full default address (at least 10 characters).'),
    ).toBeTruthy();

    const patchCalls = (apiRequest as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url, opts]) =>
        url === '/auth/profile' && (opts as { method?: string } | undefined)?.method === 'PATCH',
    );
    expect(patchCalls).toHaveLength(0);
  });

  it('requires a phone number before saving', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const saveButton = await screen.findByRole('button', { name: 'Save profile' });
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '' } });
    fireEvent.click(saveButton);

    expect(await screen.findByText('Enter your phone number.')).toBeTruthy();
    const patchCalls = (apiRequest as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url, opts]) =>
        url === '/auth/profile' && (opts as { method?: string } | undefined)?.method === 'PATCH',
    );
    expect(patchCalls).toHaveLength(0);
  });

  it('fills the default address from the current location', async () => {
    (reverseGeocode as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      label: 'MG Road, Bengaluru',
      geocoded: true,
    });
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 12.975,
          longitude: 77.6,
          accuracy: 20,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    Object.defineProperty(window.navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Use my location' }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Default address/)).toHaveValue('MG Road, Bengaluru');
    });
    expect(
      screen.getByText('Address filled from your location — edit it if needed, then save.'),
    ).toBeTruthy();
  });

  it('explains when location access is blocked', async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error?: PositionErrorCallback) => {
        error?.({ code: 1, message: 'denied' } as GeolocationPositionError);
      },
    );
    Object.defineProperty(window.navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Use my location' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy();
    });
  });
});
