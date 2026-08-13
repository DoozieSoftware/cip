import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../../shared/api/client', () => ({
  requestRaw: vi.fn(),
}));

const { requestRaw } = await import('../../../../shared/api/client');
const AdminDashboard = (await import('../AdminDashboard')).default;

function mockCounts() {
  (requestRaw as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: [],
    meta: { total: 5 },
  });
}

describe('AdminDashboard', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    mockCounts();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Platform dashboard')).toBeTruthy();
  });

  it('renders stat cards with counts', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Organizations')).toBeTruthy();
    expect(screen.getByText('Departments')).toBeTruthy();
    expect(screen.getByText('Users')).toBeTruthy();
    expect(screen.getByText('Roles')).toBeTruthy();
    expect(screen.getByText('Report types')).toBeTruthy();
    expect(screen.getByText('Security policies')).toBeTruthy();
    expect(screen.getByText('Feature flags')).toBeTruthy();
  });

  it('shows loading state', () => {
    (requestRaw as unknown as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
  });

  it('renders quick actions section', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Quick actions')).toBeTruthy();
    expect(screen.getByText('Audit log')).toBeTruthy();
    expect(screen.getByText('Tune security policies')).toBeTruthy();
  });
});
