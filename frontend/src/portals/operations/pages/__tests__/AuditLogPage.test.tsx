import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/operations', () => ({
  auditApi: {
    list: vi.fn(),
  },
}));

const opsMod = (await import('../api/operations')) as {
  auditApi: { list: ReturnType<typeof vi.fn> };
};
const { auditApi } = opsMod;
const AuditLogPage = (await import('../AuditLogPage')).default;

const AUDIT_ROWS = [
  {
    id: 'a-1',
    user_id: 'u-1',
    user_name: 'Admin',
    roles: ['super_admin'],
    entity: 'reports',
    entity_id: 'r-1',
    action: 'report.update',
    before: null,
    after: null,
    ip: '10.0.0.1',
    device_fingerprint: 'abc123',
    request_id: 'req-1',
    created_at: '2026-01-01T00:00:00Z',
  },
];

describe('OperationsAuditLogPage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    auditApi.list.mockResolvedValue({
      success: true,
      data: AUDIT_ROWS,
      meta: { current_page: 1, per_page: 50, total: 1, last_page: 1 },
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AuditLogPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Audit log')).toBeTruthy();
  });

  it('renders audit entries in a table', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AuditLogPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('report.update')).toBeTruthy();
    expect(screen.getByText('Admin')).toBeTruthy();
  });

  it('shows loading state', () => {
    auditApi.list.mockReturnValue(new Promise(() => {}));
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AuditLogPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading audit log')).toBeTruthy();
  });

  it('shows error state', async () => {
    auditApi.list.mockRejectedValue(new Error('fail'));
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AuditLogPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Could not load audit log')).toBeTruthy();
  });

  it('shows empty state when no entries', async () => {
    auditApi.list.mockResolvedValue({
      success: true,
      data: [],
      meta: { current_page: 1, per_page: 50, total: 0, last_page: 1 },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AuditLogPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('No audit events match these filters')).toBeTruthy();
  });

  it('opens filters section', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AuditLogPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('Audit log');
    fireEvent.click(screen.getByText('Filters'));
    expect(screen.getByLabelText('User ID')).toBeTruthy();
    expect(screen.getByLabelText('Action')).toBeTruthy();
  });
});
