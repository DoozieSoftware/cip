import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const mutateMock = vi.fn();

vi.mock('../../api/client', () => ({
  useSchedulerJobs: vi.fn(),
  useSchedulerAction: vi.fn(() => ({
    mutate: mutateMock,
    isPending: false,
    isError: false,
    isSuccess: false,
    variables: undefined,
    error: null,
  })),
}));

 
const { useSchedulerJobs } = await import('../../api/client');
 
const AdminScheduler = (await import('../AdminScheduler')).default;

const JOBS = [
  { id: 'send-notifications', command: 'Send queued notifications', expression: 'everyMinute', next_due_at: '2026-06-29T10:01:00Z', paused: false },
  { id: 'cleanup-audit', command: 'Cleanup old audit rows', expression: 'daily', next_due_at: '2026-06-30T00:00:00Z', paused: true },
];

describe('AdminScheduler (T-M12-026)', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    mutateMock.mockClear();
    (useSchedulerJobs as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: JOBS,
      isLoading: false,
      isFetching: false,
      isError: false,
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title and the job rows', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminScheduler />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Scheduler')).toBeTruthy();
    expect(screen.getByText('Send queued notifications')).toBeTruthy();
    expect(screen.getByText('Cleanup old audit rows')).toBeTruthy();
  });

  it('shows the running / paused counts', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminScheduler />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const counts = await screen.findByLabelText('Counts');
    expect(within(counts).getByText('Running')).toBeTruthy();
    expect(within(counts).getByText('Paused')).toBeTruthy();
    expect(within(counts).getByText('2')).toBeTruthy();
  });

  it('shows the resume button for paused jobs and pause for running', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminScheduler />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const jobsTable = await screen.findByLabelText('Jobs');
    expect(within(jobsTable).getByRole('button', { name: /Pause/ })).toBeTruthy();
    expect(within(jobsTable).getByRole('button', { name: /Resume/ })).toBeTruthy();
  });
});
