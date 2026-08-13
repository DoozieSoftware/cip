import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../api/moderator', () => ({
  analyticsApi: {
    summary: vi.fn().mockResolvedValue({
      pending_moderator: 3,
      duplicates_pending: 1,
      fraud_pending: 2,
      approved_today: 0,
      rejected_today: 0,
      merged_today: 0,
      escalated_today: 0,
      avg_review_minutes: 0,
      ai_accuracy_pct: 100,
    }),
  },
  queueApi: {
    list: vi.fn().mockResolvedValue({ data: [], next_cursor: null, prev_cursor: null }),
  },
}));

import DashboardPage from './DashboardPage';

describe('Moderator dashboard', () => {
  it('renders View all as a clearly styled touch target', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const viewAll = await screen.findByRole('button', { name: 'View all' });

    expect(viewAll).toHaveClass('min-h-[44px]', 'rounded-full', 'bg-white', 'px-4', 'ring-1');
  });
});
