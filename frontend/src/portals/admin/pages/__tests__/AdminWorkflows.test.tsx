import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const mutateMock = vi.fn();

vi.mock('../../api/client', () => ({
  useWorkflows: vi.fn(),
  useCreateWorkflow: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useUpdateWorkflow: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useDeleteWorkflow: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
}));

 
const { useWorkflows } = await import('../../api/client');
const AdminWorkflows = (await import('../AdminWorkflows')).default;

const WFS = [
  {
    id: 'wf1', code: 'report_lifecycle', name: 'Report lifecycle',
    description: null, active: true, created_at: null, updated_at: null,
    states: [
      { id: 's1', code: 'submitted', name: 'Submitted', is_terminal: false },
      { id: 's2', code: 'triaged', name: 'Triaged', is_terminal: false },
      { id: 's3', code: 'resolved', name: 'Resolved', is_terminal: true },
    ],
    transitions: [
      { id: 't1', from_state_id: 'submitted', to_state_id: 'triaged', event: 'triage', required_role: 'moderator' },
      { id: 't2', from_state_id: 'triaged', to_state_id: 'resolved', event: 'resolve', required_role: 'department_officer' },
    ],
  },
];

describe('AdminWorkflows (T-M12-019)', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    mutateMock.mockClear();
    (useWorkflows as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: WFS, isLoading: false });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminWorkflows /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Workflow builder')).toBeTruthy();
  });

  it('shows definition, state and transition counts', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminWorkflows /></MemoryRouter>
      </QueryClientProvider>,
    );
    // counts: 1 definition, 1 active, 2 transitions
    const counts = await screen.findByText('Definitions');
    expect(counts).toBeTruthy();
    const values = within(counts.closest('section') as HTMLElement).getAllByText('1');
    expect(values.length).toBeGreaterThan(0);
    expect(within(counts.closest('section') as HTMLElement).getByText('2')).toBeTruthy();
  });

  it('renders the workflow row with show matrix button', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminWorkflows /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('report_lifecycle')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show matrix' })).toBeTruthy();
  });

  it('reveals the transition matrix when show matrix is clicked', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminWorkflows /></MemoryRouter>
      </QueryClientProvider>,
    );
    const btn = await screen.findByRole('button', { name: 'Show matrix' });
    btn.click();
    const matrix = await screen.findByLabelText('Transition matrix for report_lifecycle');
    expect(within(matrix).getByText('resolved (terminal)')).toBeTruthy();
  });
});
