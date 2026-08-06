import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/client', () => ({
  useAuditLogs: vi.fn(),
}));

const { useAuditLogs } = await import('../api/client');
const AdminAuditLog = (await import('../AdminAuditLog')).default;

const LOGS = [
  {
    id: 'log-1',
    action: 'report.update',
    entity: 'Report',
    entity_id: 'r-1',
    user_id: 'u-1',
    user_name: 'Alice',
    roles: ['moderator'],
    ip: '10.0.0.1',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'log-2',
    action: 'user.login',
    entity: null,
    entity_id: null,
    user_id: 'u-2',
    user_name: null,
    roles: ['citizen'],
    ip: null,
    created_at: '2026-01-02T00:00:00Z',
  },
];

describe('AdminAuditLog', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuditLogs as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: LOGS,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminAuditLog />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Audit log')).toBeTruthy();
  });

  it('renders log entries in a table', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminAuditLog />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const table = screen.getByRole('table');
    expect(within(table).getByText('report.update')).toBeTruthy();
    expect(within(table).getByText('user.login')).toBeTruthy();
  });

  it('shows empty state when no entries', () => {
    (useAuditLogs as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminAuditLog />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('No entries found')).toBeTruthy();
  });

  it('shows loading state', () => {
    (useAuditLogs as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminAuditLog />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading audit log')).toBeTruthy();
  });

  it('shows error state with retry', () => {
    const refetch = vi.fn();
    (useAuditLogs as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminAuditLog />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Failed to load audit log')).toBeTruthy();
    fireEvent.click(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalled();
  });

  it('opens and uses filters', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminAuditLog />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText('Filters'));
    const actionInput = screen.getByPlaceholderText('e.g. report.update');
    fireEvent.change(actionInput, { target: { value: 'login' } });
    expect(useAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'login' }));
  });
});
