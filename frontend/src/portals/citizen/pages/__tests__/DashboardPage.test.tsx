import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import DashboardPage from '../DashboardPage';
import { ApiError } from '../../../../shared/api/errors';

vi.mock('../../../../auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { name: 'Test Citizen' } })),
}));

const apiRequestMock = vi.fn<
  (path?: string, options?: unknown) => Promise<{ data: unknown[] }>
>(() => Promise.resolve({ data: [] }));
vi.mock('../../../../auth/api', () => ({
  apiRequest: vi.fn((path?: string, options?: unknown) => apiRequestMock(path, options)),
  type: {},
}));

vi.mock('../../offline/queue', () => ({
  getQueue: vi.fn(() => ({ size: vi.fn(() => Promise.resolve(0)) })),
}));

const mockUseOnlineStatus = vi.fn(() => true);

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: (): boolean => mockUseOnlineStatus(),
}));

function renderPage(opts: { online?: boolean } = {}): void {
  if (opts.online !== undefined) {
    mockUseOnlineStatus.mockReturnValueOnce(opts.online);
  }
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage — loading state', () => {
  it('shows a full-page spinner while reports are loading', () => {
    let resolvePromise: (val: { data: unknown[] }) => void = () => undefined;
    apiRequestMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
    );
    renderPage();
    expect(screen.getByRole('status', { name: /loading your dashboard/i })).toBeInTheDocument();
    resolvePromise({ data: [] });
  });

  it('transitions from loading to content after data resolves', async () => {
    apiRequestMock.mockReturnValueOnce(
      Promise.resolve({
        data: [
          {
            id: 'r1',
            title: 'Pothole on Main St',
            status: { code: 'in_progress', name: 'In Progress' },
            created_at: '2026-07-01T00:00:00Z',
          },
        ],
      }),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Pothole on Main St')).toBeInTheDocument();
    });
  });
});

describe('DashboardPage — distinct failure states (P2-04)', () => {
  it('shows an error state with retry when reports query fails with no data', async () => {
    apiRequestMock.mockReturnValueOnce(Promise.reject(new Error('Network error')));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Unable to load reports')).toBeInTheDocument();
    });
    expect(screen.getByText('Check your connection and try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows auth error state when reports query returns 401', async () => {
    apiRequestMock.mockReturnValueOnce(
      Promise.reject(new ApiError(401, 'unauthorized', 'Unauthorized', null)),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Session expired')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Sign in again' })).toBeInTheDocument();
  });

  it('shows offline state when browser is offline with no cached data', async () => {
    apiRequestMock.mockReturnValueOnce(Promise.reject(new Error('Network error')));
    mockUseOnlineStatus.mockReturnValue(false);
    renderPage({ online: false });
    await waitFor(() => {
      expect(screen.getByText('You are offline')).toBeInTheDocument();
    });
  });

  it('renders the empty state when there are no reports', async () => {
    apiRequestMock.mockReturnValueOnce(Promise.resolve({ data: [] }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No reports yet')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'File a report' })).toBeInTheDocument();
  });

  it('renders the report list when data is returned', async () => {
    apiRequestMock.mockReturnValueOnce(
      Promise.resolve({
        data: [
          {
            id: 'r1',
            title: 'Pothole on Main St',
            status: { code: 'in_progress', name: 'In Progress' },
            created_at: '2026-07-01T00:00:00Z',
          },
        ],
      }),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Pothole on Main St')).toBeInTheDocument();
    });
  });

  it('shows a full-page loading state on initial load with no cached data', () => {
    let resolvePromise: (val: { data: unknown[] }) => void = () => undefined;
    apiRequestMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
    );
    renderPage();
    expect(screen.getByRole('status', { name: /loading your dashboard/i })).toBeInTheDocument();
    expect(screen.getByText('Loading your dashboard…')).toBeInTheDocument();
    resolvePromise({ data: [] });
  });

  it('does not render report list or empty state while loading initial data', () => {
    let resolvePromise: (val: { data: unknown[] }) => void = () => undefined;
    apiRequestMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
    );
    renderPage();
    expect(screen.queryByText('Recent reports')).not.toBeInTheDocument();
    expect(screen.queryByText('No reports yet')).not.toBeInTheDocument();
    resolvePromise({ data: [] });
  });

  it('shows stale warning banner when refetch fails but cached data exists', async () => {
    apiRequestMock.mockReturnValueOnce(
      Promise.resolve({
        data: [
          {
            id: 'r1',
            title: 'Pothole on Main St',
            status: { code: 'in_progress', name: 'In Progress' },
            created_at: '2026-07-01T00:00:00Z',
          },
        ],
      }),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Pothole on Main St')).toBeInTheDocument();
    });
  });
});
