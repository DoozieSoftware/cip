import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const mutateMock = vi.fn();

vi.mock('../../api/client', () => ({
  useRoutingRules: vi.fn(),
  useCreateRoutingRule: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useUpdateRoutingRule: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useDeleteRoutingRule: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useReorderRoutingRules: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
}));

 
const { useRoutingRules } = await import('../../api/client');
const AdminRoutingRules = (await import('../AdminRoutingRules')).default;

const ROWS = [
  { id: 'r1', name: 'Garbage to BBMP', description: 'Ward 112', conditions: { any_label: ['garbage'] }, destination_department_id: 'd-bbmp-w112', priority: 10, active: true, created_at: null, updated_at: null },
  { id: 'r2', name: 'Illegal parking', description: 'BTP', conditions: { any_label: ['parking'] }, destination_department_id: 'd-btp', priority: 20, active: true, created_at: null, updated_at: null },
  { id: 'r3', name: 'Disabled rule', description: '', conditions: { any_label: [] }, destination_department_id: null, priority: 99, active: false, created_at: null, updated_at: null },
];

describe('AdminRoutingRules (T-M12-020)', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    mutateMock.mockClear();
    (useRoutingRules as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: ROWS, isLoading: false });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminRoutingRules /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Routing rules')).toBeTruthy();
  });

  it('renders the rules sorted by priority (lowest first)', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminRoutingRules /></MemoryRouter>
      </QueryClientProvider>,
    );
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1); // skip header
    expect(within(rows[0]).getByText('Garbage to BBMP')).toBeTruthy();
    expect(within(rows[1]).getByText('Illegal parking')).toBeTruthy();
    expect(within(rows[2]).getByText('Disabled rule')).toBeTruthy();
  });

  it('shows the active / disabled pill for each row', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminRoutingRules /></MemoryRouter>
      </QueryClientProvider>,
    );
    const table = await screen.findByRole('table');
    expect(within(table).getAllByText('active').length).toBe(2);
    expect(within(table).getAllByText('disabled').length).toBe(1);
  });

  it('renders the new rule button', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminRoutingRules /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('button', { name: 'New rule' })).toBeTruthy();
  });
});
