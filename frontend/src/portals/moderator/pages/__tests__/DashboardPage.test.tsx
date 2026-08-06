import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/moderator', () => ({
  analyticsApi: {
    summary: vi.fn(),
  },
  queueApi: {
    list: vi.fn(),
  },
}));

const { analyticsApi, queueApi } = await import('../api/moderator');
const DashboardPage = (await import('../DashboardPage')).default;

describe('ModeratorDashboardPage', () => {
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
    (queueApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          id: 'r-1',
          tracking_number: 'CIP-ABC123',
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
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Dashboard')).toBeTruthy();
  });

  it('renders stat cards with counts', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Pending')).toBeTruthy();
    expect(screen.getByText('Duplicates')).toBeTruthy();
    expect(screen.getByText('Fraud')).toBeTruthy();
  });

  it('renders recent reports queue', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Pothole near metro')).toBeTruthy();
    expect(screen.getByText('Roads')).toBeTruthy();
  });

  it('shows loading state', () => {
    (analyticsApi.summary as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading dashboard')).toBeTruthy();
  });

  it('shows error state with retry', async () => {
    (analyticsApi.summary as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('fail'),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Could not load the dashboard')).toBeTruthy();
  });
});
