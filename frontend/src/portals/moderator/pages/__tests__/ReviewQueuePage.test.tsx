import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/moderator', () => ({
  queueApi: {
    list: vi.fn(),
  },
}));

const { queueApi } = await import('../api/moderator');
const ReviewQueuePage = (await import('../ReviewQueuePage')).default;

describe('ReviewQueuePage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (queueApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          id: 'r-1',
          tracking_number: 'CIP-001',
          title: 'Pothole near metro',
          category: { name: 'Roads' },
          status_code: 'pending_moderator',
          ai_confidence: 92,
          fraud_score: null,
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
          <ReviewQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Reports awaiting review')).toBeTruthy();
  });

  it('renders status filter tabs', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ReviewQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Pending')).toBeTruthy();
    expect(screen.getByText('AI Processing')).toBeTruthy();
    expect(screen.getByText('Assigned')).toBeTruthy();
    expect(screen.getByText('Escalated')).toBeTruthy();
  });

  it('renders report items', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ReviewQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Pothole near metro')).toBeTruthy();
    expect(screen.getByText('CIP-001')).toBeTruthy();
  });

  it('shows loading state', () => {
    (queueApi.list as unknown as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ReviewQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading reports awaiting review')).toBeTruthy();
  });

  it('shows error state', async () => {
    (queueApi.list as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ReviewQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Could not load reports awaiting review')).toBeTruthy();
  });

  it('shows empty state when no reports', async () => {
    (queueApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      next_cursor: null,
      prev_cursor: null,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ReviewQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('No reports match these filters')).toBeTruthy();
  });
});
