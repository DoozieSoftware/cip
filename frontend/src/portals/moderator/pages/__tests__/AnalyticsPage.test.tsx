import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/moderator', () => ({
  analyticsApi: {
    summary: vi.fn(),
  },
}));

const { analyticsApi } = await import('../api/moderator');
const AnalyticsPage = (await import('../AnalyticsPage')).default;

describe('AnalyticsPage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (analyticsApi.summary as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      pending_moderator: 25,
      duplicates_pending: 8,
      fraud_pending: 3,
      avg_review_minutes: 12,
      approved_today: 15,
      rejected_today: 5,
      merged_today: 2,
      escalated_today: 1,
      ai_accuracy_pct: 87.5,
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Moderator analytics')).toBeTruthy();
  });

  it('renders stat cards', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Pending moderator')).toBeTruthy();
    expect(screen.getByText('Duplicates pending')).toBeTruthy();
    expect(screen.getByText('Fraud suspects')).toBeTruthy();
    expect(screen.getByText('Avg review time')).toBeTruthy();
  });

  it('shows loading state', () => {
    (analyticsApi.summary as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading analytics')).toBeTruthy();
  });

  it('shows error state', async () => {
    (analyticsApi.summary as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('fail'),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Could not load analytics')).toBeTruthy();
  });
});
