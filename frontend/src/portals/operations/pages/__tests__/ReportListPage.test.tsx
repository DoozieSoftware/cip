import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/operations', () => ({
  departmentApi: {
    listReports: vi.fn(),
  },
}));

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}));

vi.mock('../context/DepartmentSelectionContext', () => ({
  useDepartmentSelection: vi.fn(() => ({
    selectedId: 'dept-1',
    ready: true,
    memberships: [{ id: 'dept-1', name: 'BBMP', code: 'bbmp' }],
    select: vi.fn(),
  })),
}));

vi.mock('../../../shared/geo/useReverseGeocode', () => ({
  useReverseGeocode: vi.fn(() => null),
}));

const opsMod = (await import('../api/operations')) as {
  departmentApi: Record<string, ReturnType<typeof vi.fn>>;
};
const { departmentApi } = opsMod;
const ReportListPage = (await import('../ReportListPage')).default;

const REPORTS = [
  {
    id: 'r-1',
    tracking_number: 'CIP-001',
    title: 'Pothole near metro',
    current_status_code: 'assigned',
    report_type: { code: 'roads', name: 'Roads' },
    submitted_at: '2026-01-01T00:00:00Z',
    priority: { code: 'medium', name: 'Medium' },
    location: null,
    assignment: null,
    department_sla_minutes: 240,
    created_at: '2026-01-01T00:00:00Z',
  },
];

describe('ReportListPage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    departmentApi.listReports.mockResolvedValue({
      data: REPORTS,
      meta: { current_page: 1, per_page: 20, total: 1, last_page: 1 },
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ReportListPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Assigned reports')).toBeTruthy();
  });

  it('renders report items', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ReportListPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Pothole near metro')).toBeTruthy();
    expect(screen.getByText('CIP-001')).toBeTruthy();
  });

  it('shows loading state', () => {
    departmentApi.listReports.mockReturnValue(new Promise(() => {}));
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ReportListPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading reports')).toBeTruthy();
  });

  it('shows error state', async () => {
    departmentApi.listReports.mockRejectedValue(new Error('fail'));
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ReportListPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Could not load reports')).toBeTruthy();
  });

  it('shows empty state when no reports', async () => {
    departmentApi.listReports.mockResolvedValue({
      data: [],
      meta: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ReportListPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('No reports match')).toBeTruthy();
  });
});
