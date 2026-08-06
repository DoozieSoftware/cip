import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/moderator', () => ({
  analyticsApi: {
    aiPerformance: vi.fn(),
  },
}));

const { analyticsApi } = await import('../api/moderator');
const AiPerformancePage = (await import('../AiPerformancePage')).default;

describe('AiPerformancePage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (analyticsApi.aiPerformance as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      total_ai_decisions: 120,
      overridden_by_moderator: 18,
      override_rate_pct: 15.0,
      per_provider: [
        {
          provider_code: 'mock',
          total: 100,
          overridden: 10,
          avg_confidence: 88.5,
        },
      ],
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AiPerformancePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('AI performance')).toBeTruthy();
  });

  it('renders AI performance metrics', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AiPerformancePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('120')).toBeTruthy();
    expect(screen.getByText('18')).toBeTruthy();
    expect(screen.getByText('15.0%')).toBeTruthy();
  });

  it('renders per-provider table', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AiPerformancePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Per provider')).toBeTruthy();
    expect(screen.getByText('mock')).toBeTruthy();
  });

  it('shows loading state', () => {
    (analyticsApi.aiPerformance as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AiPerformancePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading AI performance')).toBeTruthy();
  });

  it('shows error state', async () => {
    (analyticsApi.aiPerformance as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('fail'),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AiPerformancePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Could not load AI performance')).toBeTruthy();
  });
});
