import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/operations', () => ({
  departmentApi: {
    dashboard: vi.fn(),
    listReports: vi.fn(),
    memberships: vi.fn(),
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

vi.mock('echarts-for-react', () => ({
  default: () => <div data-testid="echarts-mock" />,
}));

const { departmentApi } = await import('../api/operations');
const AnalyticsPage = (await import('../AnalyticsPage')).default;

describe('OperationsAnalyticsPage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (departmentApi.dashboard as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { open: 15, due_today: 3, sla_breached: 1, by_category: { roads: 8, sanitation: 7 } },
    });
    (departmentApi.listReports as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          id: 'r-1',
          tracking_number: 'CIP-001',
          title: 'Pothole',
          current_status_code: 'assigned',
          report_type: { code: 'roads', name: 'Roads' },
          submitted_at: '2026-01-01T00:00:00Z',
          priority: { code: 'medium', name: 'Medium' },
          location: null,
          assignment: null,
          department_sla_minutes: 240,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Analytics')).toBeTruthy();
  });

  it('renders stat cards', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Open reports')).toBeTruthy();
    expect(screen.getByText('Due today')).toBeTruthy();
    expect(screen.getByText('SLA breached')).toBeTruthy();
  });

  it('shows loading state', () => {
    (departmentApi.dashboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading analytics')).toBeTruthy();
  });

  it('shows error state', async () => {
    (departmentApi.dashboard as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('fail'),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Could not load analytics')).toBeTruthy();
  });
});
