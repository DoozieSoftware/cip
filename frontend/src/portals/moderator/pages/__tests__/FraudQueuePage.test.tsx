import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/moderator', () => ({
  queueApi: {
    fraud: vi.fn(),
  },
}));

const { queueApi } = await import('../api/moderator');
const FraudQueuePage = (await import('../FraudQueuePage')).default;

describe('FraudQueuePage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (queueApi.fraud as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          id: 'r-1',
          tracking_number: 'CIP-FRAUD001',
          title: 'Suspicious report',
          category: { name: 'Sanitation' },
          status_code: 'pending_moderator',
          ai_confidence: 45,
          fraud_score: 88,
          duplicate_score: null,
          mock_gps_score: null,
          submitted_at: '2026-01-01T00:00:00Z',
          ward: null,
          district: null,
          evidence_count: 0,
          department: null,
        },
      ],
      next_cursor: null,
      prev_cursor: null,
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <FraudQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Fraud review')).toBeTruthy();
  });

  it('renders fraud suspects', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <FraudQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('CIP-FRAUD001')).toBeTruthy();
    expect(screen.getByText('Sanitation')).toBeTruthy();
  });

  it('shows loading state', () => {
    (queueApi.fraud as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <FraudQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading fraud review')).toBeTruthy();
  });

  it('shows error state', async () => {
    (queueApi.fraud as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('fail'),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <FraudQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Could not load fraud review')).toBeTruthy();
  });

  it('shows empty state when no fraud suspects', async () => {
    (queueApi.fraud as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      next_cursor: null,
      prev_cursor: null,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <FraudQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('No fraud suspects')).toBeTruthy();
  });
});
