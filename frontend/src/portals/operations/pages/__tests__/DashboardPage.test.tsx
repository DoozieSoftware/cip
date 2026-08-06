import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/operations', () => ({
  departmentApi: {
    dashboard: vi.fn(),
  },
}));

vi.mock('../context/DepartmentSelectionContext', () => ({
  useDepartmentSelection: vi.fn(() => ({
    selectedId: 'dept-1',
    ready: true,
    memberships: [{ id: 'dept-1', name: 'BBMP', code: 'bbmp' }],
    select: vi.fn(),
  })),
}));

const { departmentApi } = await import('../api/operations');
const DashboardPage = (await import('../DashboardPage')).default;

describe('OperationsDashboardPage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (departmentApi.dashboard as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        open: 15,
        due_today: 3,
        sla_breached: 1,
        by_category: { roads: 8, sanitation: 5, water: 2 },
      },
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Department at a glance')).toBeTruthy();
  });

  it('renders metric cards', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Open reports')).toBeTruthy();
    expect(screen.getByText('Due today')).toBeTruthy();
    expect(screen.getByText('SLA breached')).toBeTruthy();
  });

  it('renders category breakdown', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('roads')).toBeTruthy();
    expect(screen.getByText('sanitation')).toBeTruthy();
  });

  it('shows loading state', () => {
    (departmentApi.dashboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading dashboard')).toBeTruthy();
  });

  it('shows error state with retry', async () => {
    (departmentApi.dashboard as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('fail'),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Could not load the dashboard')).toBeTruthy();
  });

  it('shows empty category state', async () => {
    (departmentApi.dashboard as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { open: 0, due_today: 0, sla_breached: 0, by_category: {} },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('No open reports')).toBeTruthy();
  });
});
