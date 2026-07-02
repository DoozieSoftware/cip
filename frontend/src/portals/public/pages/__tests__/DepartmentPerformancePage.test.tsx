import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DepartmentPerformancePage from '../DepartmentPerformancePage';

const apiRequestMock = vi.fn();

vi.mock('../../../../auth/api', () => ({
  apiRequest: (...args: unknown[]): Promise<unknown> => apiRequestMock(...args) as Promise<unknown>,
}));

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DepartmentPerformancePage />
    </QueryClientProvider>,
  );
}

describe('Public DepartmentPerformancePage', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it('fetches /public/departments/performance and renders only public-safe fields', async () => {
    apiRequestMock.mockResolvedValue({
      data: {
        departments: [
          {
            id: 'd1',
            name: 'BBMP Roads',
            code: 'BBMP-R',
            total_reports: 40,
            resolved_reports: 30,
            resolution_rate_percent: 75,
            median_resolution_hours: 30,
          },
        ],
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('BBMP Roads')).toBeTruthy();
    });
    expect(screen.getByText('BBMP-R')).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText('1.3d')).toBeTruthy();
    expect(apiRequestMock).toHaveBeenCalledWith('/public/departments/performance');
  });

  it('shows an empty state when no department has any reports yet', async () => {
    apiRequestMock.mockResolvedValue({ data: { departments: [] } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No department data yet')).toBeTruthy();
    });
  });

  it('formats a null median resolution time as an em dash', async () => {
    apiRequestMock.mockResolvedValue({
      data: {
        departments: [
          { id: 'd1', name: 'BTP', code: 'BTP', total_reports: 5, resolved_reports: 0, resolution_rate_percent: 0, median_resolution_hours: null },
        ],
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('—')).toBeTruthy();
    });
  });
});
