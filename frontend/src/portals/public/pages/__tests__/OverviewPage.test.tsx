import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OverviewPage from '../OverviewPage';

const apiRequestMock = vi.fn();

vi.mock('../../../../auth/api', () => ({
  apiRequest: (...args: unknown[]): Promise<unknown> => apiRequestMock(...args) as Promise<unknown>,
}));

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <OverviewPage />
    </QueryClientProvider>,
  );
}

describe('Public OverviewPage', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it('fetches /public/stats and renders the aggregate numbers', async () => {
    apiRequestMock.mockResolvedValue({
      data: { total_reports: 900, ai_classified_percent: 72.5, median_assign_seconds: 45 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('900')).toBeTruthy();
    });
    expect(screen.getByText('72.5%')).toBeTruthy();
    expect(screen.getByText('45s')).toBeTruthy();
    expect(apiRequestMock).toHaveBeenCalledWith('/public/stats');
  });

  it('shows a fallback message when the request fails', async () => {
    apiRequestMock.mockRejectedValue(new Error('down'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Statistics unavailable')).toBeTruthy();
    });
  });
});
