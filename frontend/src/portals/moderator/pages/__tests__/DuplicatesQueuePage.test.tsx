import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/moderator', () => ({
  queueApi: {
    duplicates: vi.fn(),
  },
}));

const { queueApi } = await import('../api/moderator');
const DuplicatesQueuePage = (await import('../DuplicatesQueuePage')).default;

describe('DuplicatesQueuePage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (queueApi.duplicates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          id: 'r-1',
          tracking_number: 'CIP-DUP001',
          title: 'Duplicate report',
          category: { name: 'Roads' },
          status_code: 'pending_moderator',
          ai_confidence: 85,
          fraud_score: null,
          duplicate_score: 92,
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
          <DuplicatesQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Duplicate review')).toBeTruthy();
  });

  it('renders duplicate candidates', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DuplicatesQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('CIP-DUP001')).toBeTruthy();
    expect(screen.getByText('Roads')).toBeTruthy();
  });

  it('shows loading state', () => {
    (queueApi.duplicates as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DuplicatesQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading duplicates')).toBeTruthy();
  });

  it('shows error state', async () => {
    (queueApi.duplicates as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('fail'),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DuplicatesQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Could not load duplicates')).toBeTruthy();
  });

  it('shows empty state when no duplicates', async () => {
    (queueApi.duplicates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      next_cursor: null,
      prev_cursor: null,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DuplicatesQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('No duplicate candidates')).toBeTruthy();
  });
});
