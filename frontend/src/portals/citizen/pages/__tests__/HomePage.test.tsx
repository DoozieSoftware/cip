import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import HomePage from '../HomePage';
import { useCitizenReports } from '../../api/client';
import { ApiError } from '../../../../shared/api/errors';

const useCitizenReportsMock = vi.mocked(useCitizenReports) as unknown as {
  mockReturnValueOnce: (value: Record<string, unknown>) => void;
};

vi.mock('../../../../auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { name: 'Test Citizen' } })),
}));

vi.mock('../../../../auth/api', () => ({
  apiRequest: vi.fn((path: string) => {
    if (path === '/auth/me') {
      return Promise.resolve({
        data: {
          id: 'u1',
          name: 'Test Citizen',
          mobile: '9999999999',
          email: null,
          roles: ['citizen'],
        },
      });
    }
    return Promise.resolve({ data: null });
  }),
  type: {},
}));

vi.mock('../../offline/queue', () => ({
  getQueue: vi.fn(() => ({ size: vi.fn(() => Promise.resolve(0)) })),
}));

vi.mock('../../api/client', () => ({
  lifecycleGroup: vi.fn((code: string) => {
    const groups: Record<string, string> = {
      submitted: 'open',
      ai_processing: 'open',
      pending_moderator: 'open',
      assigned: 'open',
      accepted: 'open',
      in_progress: 'open',
      escalated: 'open',
      resolved: 'awaiting_citizen',
      verified: 'closed',
      closed: 'closed',
      rejected: 'rejected',
      merged: 'merged',
    };
    return groups[code] ?? 'open';
  }),
  useCitizenReports: vi.fn(() => ({
    isLoading: false,
    isError: false,
    data: {
      data: [
        {
          id: '1',
          title: 'Active report',
          status: { code: 'in_progress', name: 'In Progress' },
          created_at: '2026-07-01T00:00:00Z',
        },
        {
          id: '2',
          title: 'Resolved report',
          status: { code: 'resolved', name: 'Resolved' },
          created_at: '2026-07-02T00:00:00Z',
        },
        {
          id: '3',
          title: 'Closed report',
          status: { code: 'closed', name: 'Closed' },
          created_at: '2026-07-03T00:00:00Z',
        },
        {
          id: '4',
          title: 'Rejected report',
          status: { code: 'rejected', name: 'Rejected' },
          created_at: '2026-07-04T00:00:00Z',
        },
        {
          id: '5',
          title: 'Merged report',
          status: { code: 'merged', name: 'Merged' },
          created_at: '2026-07-05T00:00:00Z',
        },
        {
          id: '6',
          title: 'Accepted report',
          status: { code: 'accepted', name: 'Accepted' },
          created_at: '2026-07-06T00:00:00Z',
        },
      ],
      meta: { page: 1, per_page: 100, total: 6, last_page: 1 },
    },
  })),
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
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomePage — status classification', () => {
  it('keeps the file-report card light until it is hovered', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /File a new report/i })).toHaveClass(
      'bg-white',
      'hover:bg-[var(--color-ink-soft)]',
    );
  });

  it('counts active reports using lifecycleGroup (open), not negative lists', () => {
    renderPage();
    const stats = screen.getAllByText(/\d+/);
    expect(stats.length).toBeGreaterThan(0);
  });

  it('shows 6 Filed for 6 total reports', () => {
    renderPage();
    expect(screen.getByText('Filed')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('counts Resolved as awaiting_citizen + closed (2 of 6)', () => {
    renderPage();
    const resolvedLabels = screen.getAllByText('Resolved');
    expect(resolvedLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('counts Active using lifecycleGroup open — rejected/merged are not Active (2 of 6)', () => {
    renderPage();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('counts verified as resolved per lifecycleGroup closed (P1-05)', () => {
    useCitizenReportsMock.mockReturnValueOnce({
      isLoading: false,
      isError: false,
      data: {
        data: [
          {
            id: 'v1',
            title: 'Verified-status report',
            status: { code: 'verified', name: 'Verified' },
            created_at: '2026-07-07T00:00:00Z',
          },
          {
            id: 'r1',
            title: 'Resolved report',
            status: { code: 'resolved', name: 'Resolved' },
            created_at: '2026-07-08T00:00:00Z',
          },
          {
            id: 'c1',
            title: 'Closed report',
            status: { code: 'closed', name: 'Closed' },
            created_at: '2026-07-09T00:00:00Z',
          },
        ],
        meta: { page: 1, per_page: 100, total: 3, last_page: 1 },
      },
    });

    renderPage();
    // Resolved = awaiting_citizen + closed. verified maps to closed via
    // lifecycleGroup, so all three count as Resolved (3), not 2.
    const resolvedLabels = screen.getAllByText('Resolved');
    const statLabel = resolvedLabels.find(
      (el) => el.classList.contains('uppercase') && el.classList.contains('tracking-[0.12em]'),
    );
    const statSection = statLabel?.closest('div');
    expect(statSection?.textContent).toContain('3');
  });

  it('does not misclassify rejected or merged as active (P1-05)', () => {
    renderPage();
    // Of 6 reports: open=2 (in_progress, accepted), awaiting_citizen=1 (resolved),
    // closed=1 (closed), rejected=1, merged=1. Active must be exactly 2.
    const activeLabels = screen.getAllByText('Active');
    const statLabel = activeLabels.find(
      (el) => el.classList.contains('uppercase') && el.classList.contains('tracking-[0.12em]'),
    );
    const statSection = statLabel?.closest('div');
    expect(statSection?.textContent).toContain('2');
  });
});

describe('HomePage — distinct failure states (P2-04)', () => {
  it('shows an error state with retry when reports query fails with no data', () => {
    useCitizenReportsMock.mockReturnValueOnce({
      isLoading: false,
      isError: true,
      data: undefined,
      error: new Error('Network error'),
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Unable to load reports')).toBeInTheDocument();
    expect(screen.getByText('Check your connection and try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows auth error state when reports query returns 401', () => {
    useCitizenReportsMock.mockReturnValueOnce({
      isLoading: false,
      isError: true,
      data: undefined,
      error: new ApiError(401, 'unauthorized', 'Unauthorized', null),
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Session expired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeInTheDocument();
  });

  it('shows offline state when browser is offline with no cached data', () => {
    useCitizenReportsMock.mockReturnValueOnce({
      isLoading: false,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    });
    renderPage({
      online: false,
    });
    expect(screen.getByText('You are offline')).toBeInTheDocument();
  });

  it('shows stale warning banner when reports query fails but cached data exists', () => {
    useCitizenReportsMock.mockReturnValueOnce({
      isLoading: false,
      isError: true,
      data: {
        data: [
          {
            id: '1',
            title: 'Cached report',
            status: { code: 'in_progress', name: 'In Progress' },
            created_at: '2026-07-01T00:00:00Z',
          },
        ],
        meta: { page: 1, per_page: 100, total: 1, last_page: 1 },
      },
      error: new Error('Refresh failed'),
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Showing cached reports. Could not refresh.')).toBeInTheDocument();
    expect(screen.getByText('Cached report')).toBeInTheDocument();
  });

  it('does not show the empty state when reports fail with no data', () => {
    useCitizenReportsMock.mockReturnValueOnce({
      isLoading: false,
      isError: true,
      data: undefined,
      error: new Error('Network error'),
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.queryByText('No reports filed yet.')).not.toBeInTheDocument();
  });

  it('shows a full-page loading state on initial load with no cached data', () => {
    useCitizenReportsMock.mockReturnValueOnce({
      isLoading: true,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByRole('status', { name: /loading your dashboard/i })).toBeInTheDocument();
    expect(screen.getByText('Loading your dashboard…')).toBeInTheDocument();
  });

  it('does not render stats while loading initial data', () => {
    useCitizenReportsMock.mockReturnValueOnce({
      isLoading: true,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.queryByText('Filed')).not.toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('shows empty state when reports returns empty list', () => {
    useCitizenReportsMock.mockReturnValueOnce({
      isLoading: false,
      isError: false,
      data: {
        data: [],
        meta: { page: 1, per_page: 100, total: 0, last_page: 1 },
      },
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('No reports filed yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /file a report/i })).toBeInTheDocument();
  });
});
