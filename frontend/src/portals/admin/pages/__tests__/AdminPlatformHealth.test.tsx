import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../api/client', () => ({
  usePlatformHealth: vi.fn(),
  usePlatformHealthComponents: vi.fn(),
}));

 
const { usePlatformHealth, usePlatformHealthComponents } = await import('../../api/client');
 
const AdminPlatformHealth = (await import('../AdminPlatformHealth')).default;

const SUMMARY = {
  status: 'ok' as const,
  checked_at: '2026-06-29T10:00:00Z',
  components: {
    database: { status: 'ok' as const, latency_ms: 5, detail: 'select 1 succeeded', checked_at: '2026-06-29T10:00:00Z', driver: 'sqlite' },
    redis: { status: 'degraded' as const, latency_ms: 50, detail: 'slow', checked_at: '2026-06-29T10:00:00Z' },
  },
};
const COMPONENTS = {
  checked_at: '2026-06-29T10:00:00Z',
  components: {
    database: { status: 'ok' as const, latency_ms: 5, detail: 'select 1 succeeded', checked_at: '2026-06-29T10:00:00Z', driver: 'sqlite' },
    redis: { status: 'degraded' as const, latency_ms: 50, detail: 'slow', checked_at: '2026-06-29T10:00:00Z' },
    queue: { status: 'ok' as const, latency_ms: 1, detail: 'queue reachable', checked_at: '2026-06-29T10:00:00Z' },
  },
};

describe('AdminPlatformHealth (T-M12-025)', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (usePlatformHealth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: SUMMARY,
      isLoading: false,
      isFetching: false,
      isError: false,
    });
    (usePlatformHealthComponents as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: COMPONENTS,
      isLoading: false,
      isFetching: false,
      isError: false,
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title and the overall OK status', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminPlatformHealth />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Platform health')).toBeTruthy();
    const overall = await screen.findByLabelText('Overall status');
    expect(within(overall).getByText('OK')).toBeTruthy();
  });

  it('renders one row per component', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminPlatformHealth />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const table = await screen.findByLabelText('Components');
    expect(within(table).getByText('Database')).toBeTruthy();
    expect(within(table).getByText('Redis cache')).toBeTruthy();
    expect(within(table).getByText('Job queue')).toBeTruthy();
  });

  it('renders the degraded status pill for redis', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminPlatformHealth />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const table = await screen.findByLabelText('Components');
    expect(within(table).getAllByText('degraded').length).toBeGreaterThan(0);
  });
});
