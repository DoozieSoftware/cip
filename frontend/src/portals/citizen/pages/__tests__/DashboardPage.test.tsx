import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../../auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'u-1', name: 'Jane Doe', mobile: '+919999999999' },
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

vi.mock('../../moderator/design', () => ({
  Spinner: ({ label }: { label?: string }) => <div data-testid="spinner">{label}</div>,
  EmptyState: ({
    title,
    description,
  }: {
    title: string;
    description?: string;
    action?: React.ReactNode;
  }) => (
    <div data-testid="empty-state">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  ),
}));

vi.mock('../components/StatusBadge', () => ({
  StatusBadge: ({ status }: { status: { code: string; name?: string } }) => (
    <span data-testid="status-badge">{status.name ?? status.code}</span>
  ),
}));

vi.mock('../offline/queue', () => ({
  getQueue: vi.fn(() => ({ size: vi.fn() })),
}));

const { apiRequest } = await import('../../../../auth/api');
const { getQueue } = await import('../offline/queue');
const DashboardPage = (await import('../DashboardPage')).default;

describe('DashboardPage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          id: 'r-1',
          title: 'Pothole near metro',
          status: { code: 'submitted', name: 'Submitted' },
          created_at: '2026-07-01T10:00:00Z',
        },
      ],
    });
    (getQueue as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      size: vi.fn().mockResolvedValue(0),
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the welcome message with the user name', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/Welcome, Jane Doe/)).toBeTruthy();
  });

  it('renders the submit CTA', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('+ Report a new issue')).toBeTruthy();
  });

  it('renders recent reports section', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Recent reports')).toBeTruthy();
    expect(screen.getByText('Pothole near metro')).toBeTruthy();
  });

  it('renders empty state when no reports exist', async () => {
    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('No reports yet')).toBeTruthy();
  });

  it('renders loading state while reports are loading', () => {
    (apiRequest as unknown as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading reports')).toBeTruthy();
  });

  it('renders queue status when items are waiting to sync', async () => {
    (getQueue as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      size: vi.fn().mockResolvedValue(3),
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/3 items waiting to sync/)).toBeTruthy();
  });
});
