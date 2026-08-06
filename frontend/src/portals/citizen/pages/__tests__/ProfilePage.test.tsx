import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('shows loading state', () => {
    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading profile')).toBeTruthy();
  });
});
