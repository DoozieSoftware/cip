import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/operations', () => ({
  securityApi: {
    dashboard: vi.fn(),
  },
}));

const { securityApi } = await import('../api/operations');
const SecurityPage = (await import('../SecurityPage')).default;

describe('SecurityPage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (securityApi.dashboard as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        failed_logins: { count: 5, recent: [] },
        locked_accounts: { count: 2, recent: [] },
        mock_gps_reports: { count: 3, recent: [] },
        spam_detection: { count: 1, recent: [] },
        rate_limited_users: { count: 4, recent: [] },
        suspicious_devices: { count: 0, recent: [] },
        blocked_users: { count: 1, recent: [] },
        security_alerts: { count: 2, recent: [] },
        generated_at: '2026-01-01T00:00:00Z',
      },
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SecurityPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Security dashboard')).toBeTruthy();
  });

  it('renders security widget cards', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SecurityPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Failed logins')).toBeTruthy();
    expect(screen.getByText('Locked accounts')).toBeTruthy();
    expect(screen.getByText('Fake location reports')).toBeTruthy();
    expect(screen.getByText('Spam detection')).toBeTruthy();
  });

  it('shows loading state', () => {
    (securityApi.dashboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SecurityPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading security dashboard')).toBeTruthy();
  });

  it('shows error state', async () => {
    (securityApi.dashboard as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('fail'),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SecurityPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Could not load security dashboard')).toBeTruthy();
  });

  it('shows empty data state', async () => {
    (securityApi.dashboard as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: null,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SecurityPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('No data')).toBeTruthy();
  });
});
