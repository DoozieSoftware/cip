import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../api/moderator', () => ({
  queueApi: {
    list: vi.fn().mockResolvedValue({ data: [], next_cursor: null, prev_cursor: null }),
    reportTypes: vi
      .fn()
      .mockResolvedValue([
        { id: 'internal-category-1', code: 'roads', name: 'Roads and potholes' },
      ]),
  },
}));

import { queueApi } from '../api/moderator';
import ReviewQueuePage from './ReviewQueuePage';

describe('Moderator review queue', () => {
  it('filters by a category name while sending its internal code', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ReviewQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const category = screen.getByRole('combobox', { name: 'Category' });
    expect(screen.queryByPlaceholderText(/category code/i)).not.toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Roads and potholes' })).toHaveValue('roads');

    fireEvent.change(category, { target: { value: 'roads' } });

    await waitFor(() => {
      expect(queueApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: 'roads' }),
      );
    });
  });

  it('shows completed reports, including citizen-confirmed and closed statuses', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ReviewQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Completed' }));

    await waitFor(() => {
      expect(queueApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'verified,closed' }),
      );
    });
    expect(screen.getByRole('heading', { name: 'Completed reports' })).toBeInTheDocument();
  });
});
