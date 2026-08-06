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

vi.mock('../api/client', () => ({
  useCitizenReports: vi.fn(),
}));

vi.mock('../offline/queue', () => ({
  getQueue: vi.fn(() => ({ size: vi.fn(() => 0) })),
}));

const { apiRequest } = await import('../../../../auth/api');
const { useCitizenReports } = await import('../api/client');
const HomePage = (await import('../HomePage')).default;

describe('CitizenHomePage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { id: 'u-1', name: 'John Doe', mobile: '+919999999999', roles: ['citizen'] },
    });
    (useCitizenReports as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        data: [
          {
            id: 'r-1',
            title: 'Pothole near metro',
            status: { code: 'pending_moderator', name: 'Pending' },
          },
        ],
        meta: { total: 1, page: 1, per_page: 100, last_page: 1 },
      },
      isLoading: false,
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the welcome message', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/Good morning, John/)).toBeTruthy();
  });

  it('renders stat counts', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Filed')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Resolved')).toBeTruthy();
  });

  it('renders recent reports section', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Your latest reports')).toBeTruthy();
  });

  it('renders empty reports message when no reports', async () => {
    (useCitizenReports as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { data: [], meta: { total: 0, page: 1, per_page: 100, last_page: 1 } },
      isLoading: false,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('No reports filed yet.')).toBeTruthy();
  });
});
