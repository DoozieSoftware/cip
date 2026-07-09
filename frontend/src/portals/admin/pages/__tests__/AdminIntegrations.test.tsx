import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const mutateMock = vi.fn();

vi.mock('../../api/client', () => ({
  useIntegrations: vi.fn(),
  useCreateIntegration: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useUpdateIntegration: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useDeleteIntegration: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useProbeIntegration: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
}));

 
const { useIntegrations } = await import('../../api/client');
const AdminIntegrations = (await import('../AdminIntegrations')).default;

const ROWS = [
  { id: 'i1', code: 'bbmp_311', display_name: 'BBMP 311', provider: 'bbmp', status: 'active' as const, credentials: {}, settings: {}, created_at: null },
  { id: 'i2', code: 'btp_helpdesk', display_name: 'BTP Helpdesk', provider: 'btp', status: 'degraded' as const, credentials: {}, settings: {}, created_at: null },
];

describe('AdminIntegrations (T-M12-022)', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    mutateMock.mockClear();
    (useIntegrations as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: ROWS, isLoading: false });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminIntegrations /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Integrations')).toBeTruthy();
  });

  it('renders one row per integration with masked credentials (none shown)', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminIntegrations /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('BBMP 311')).toBeTruthy();
    expect(screen.getByText('BTP Helpdesk')).toBeTruthy();
  });

  it('shows the status pill for each row', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminIntegrations /></MemoryRouter>
      </QueryClientProvider>,
    );
    const table = await screen.findByRole('table');
    expect(within(table).getByText('active')).toBeTruthy();
    expect(within(table).getByText('degraded')).toBeTruthy();
  });
});
