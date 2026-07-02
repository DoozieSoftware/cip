import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthContext';
import { LandingPage } from '../LandingPage';

const apiRequestMock = vi.fn();

vi.mock('../../auth/api', () => ({
  apiRequest: (...args: unknown[]): Promise<unknown> => apiRequestMock(...args) as Promise<unknown>,
  ApiError: class ApiError extends Error {},
}));

function renderLandingPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AuthProvider>
          <LandingPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LandingPage — public stats', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it('fetches /public/stats and renders the real numbers, not hardcoded ones', async () => {
    apiRequestMock.mockResolvedValue({
      data: { total_reports: 4200, ai_classified_percent: 87.3, median_assign_seconds: 95 },
    });

    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByText('4,200')).toBeTruthy();
    });
    expect(screen.getByText('87.3%')).toBeTruthy();
    expect(screen.getByText('1m 35s')).toBeTruthy();
    expect(apiRequestMock).toHaveBeenCalledWith('/public/stats');

    // The old hardcoded stakeholder-facing values must be gone.
    expect(screen.queryByText('12,847')).toBeNull();
    expect(screen.queryByText('94%')).toBeNull();
    expect(screen.queryByText('38s')).toBeNull();
  });

  it('shows a loading state before the stats resolve', () => {
    apiRequestMock.mockImplementation(() => new Promise(() => {}));

    renderLandingPage();

    expect(screen.getByText('Loading live stats…')).toBeTruthy();
  });

  it('shows a fallback message when the stats request fails, without crashing', async () => {
    apiRequestMock.mockRejectedValue(new Error('network down'));

    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByText('Live stats are unavailable right now.')).toBeTruthy();
    });
  });

  it('formats a null median as an em dash', async () => {
    apiRequestMock.mockResolvedValue({
      data: { total_reports: 0, ai_classified_percent: 0, median_assign_seconds: null },
    });

    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByText('—')).toBeTruthy();
    });
  });

  it('links to the public transparency portal', () => {
    apiRequestMock.mockImplementation(() => new Promise(() => {}));

    renderLandingPage();

    const link = screen.getByRole('link', { name: /public transparency portal/i });
    expect(link.getAttribute('href')).toBe('/public');
  });
});
