import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/client', () => ({
  useSecurityPolicies: vi.fn(),
  useUpsertSecurityPolicy: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

const { useSecurityPolicies } = await import('../api/client');
const AdminSecurityPolicies = (await import('../AdminSecurityPolicies')).default;

const POLICIES = [
  {
    id: 'sp-1',
    key: 'password_min_length',
    value: { min: 8 },
    type: 'json',
    description: 'Minimum password length',
  },
  {
    id: 'sp-2',
    key: 'otp_ttl_seconds',
    value: 300,
    type: 'int',
    description: 'OTP time-to-live',
  },
];

describe('AdminSecurityPolicies', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (useSecurityPolicies as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: POLICIES,
      isLoading: false,
      isError: false,
      error: null,
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminSecurityPolicies />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Security policies')).toBeTruthy();
  });

  it('renders policies in a table', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminSecurityPolicies />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('password_min_length')).toBeTruthy();
    expect(screen.getByText('otp_ttl_seconds')).toBeTruthy();
  });

  it('shows loading state', () => {
    (useSecurityPolicies as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminSecurityPolicies />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading policies')).toBeTruthy();
  });

  it('shows error state', () => {
    (useSecurityPolicies as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('fail'),
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminSecurityPolicies />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Failed to load policies')).toBeTruthy();
  });

  it('shows empty state when no policies', () => {
    (useSecurityPolicies as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminSecurityPolicies />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('No policies')).toBeTruthy();
  });
});
