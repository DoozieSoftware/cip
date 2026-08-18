import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

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
    expect(screen.getByText('Full name')).toBeTruthy();
    expect(screen.getByText('Mobile number')).toBeTruthy();
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
});
