import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const mutateMock = vi.fn();

vi.mock('../../api/client', () => ({
  useNotificationConfigs: vi.fn(),
  useUpsertNotificationConfig: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useDeleteNotificationConfig: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
}));

 
const { useNotificationConfigs } = await import('../../api/client');
const AdminNotificationConfigs = (await import('../AdminNotificationConfigs')).default;

const ROWS = [
  { id: 'c1', channel: 'mail' as const, code: 'default_mail', display_name: 'Default SMTP', active: true, credentials: {}, retry_policy: { tries: 3, backoff: [60, 300, 900] } },
  { id: 'c2', channel: 'sms' as const, code: 'log_sms', display_name: 'Log SMS (dev)', active: false, credentials: {}, retry_policy: { tries: 2, backoff: [60, 300] } },
];

describe('AdminNotificationConfigs (T-M12-022)', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    mutateMock.mockClear();
    (useNotificationConfigs as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: ROWS, isLoading: false });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminNotificationConfigs /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Notification configs')).toBeTruthy();
  });

  it('renders one row per config with the channel pill', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminNotificationConfigs /></MemoryRouter>
      </QueryClientProvider>,
    );
    const table = await screen.findByRole('table');
    expect(within(table).getByText('mail')).toBeTruthy();
    expect(within(table).getByText('sms')).toBeTruthy();
    expect(within(table).getByText('Default SMTP')).toBeTruthy();
    expect(within(table).getByText('Log SMS (dev)')).toBeTruthy();
  });

  it('renders the toggle switch and delete button for each row', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminNotificationConfigs /></MemoryRouter>
      </QueryClientProvider>,
    );
    const toggles = await screen.findAllByRole('button', { name: /Toggle/ });
    expect(toggles.length).toBe(2);
    expect(screen.getAllByRole('button', { name: 'Delete' }).length).toBe(2);
  });
});
