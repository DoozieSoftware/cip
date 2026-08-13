import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../../../../shared/api/errors';
import { setLocale } from '../../messages';

const mockUseNotifications = vi.fn();
const mockUseMarkNotificationRead = vi.fn(() => ({ mutate: vi.fn() }));
const mockUseOnlineStatus = vi.fn();

vi.mock('../../api/client', () => ({
  useNotifications: (): ReturnType<typeof mockUseNotifications> => mockUseNotifications(),
  useMarkNotificationRead: (): ReturnType<typeof mockUseMarkNotificationRead> =>
    mockUseMarkNotificationRead(),
}));

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: (): ReturnType<typeof mockUseOnlineStatus> => mockUseOnlineStatus(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  setLocale('en-IN');
  mockUseOnlineStatus.mockReturnValue(true);
});

async function renderPage() {
  const NotificationsPage = (await import('../NotificationsPage')).default;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NotificationsPage', () => {
  it('renders a loading spinner while fetching notifications', async () => {
    mockUseNotifications.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
      error: null,
    });
    await renderPage();
    expect(screen.getByRole('status', { name: 'Loading notifications' })).toBeTruthy();
  });

  it('renders the empty state when there are no notifications', async () => {
    mockUseNotifications.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
      error: null,
    });
    await renderPage();
    expect(screen.getByText('No notifications')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'File a report' })).toBeTruthy();
  });

  it('renders an error state with retry when the query fails without data', async () => {
    const refetch = vi.fn();
    mockUseNotifications.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      error: new Error('Network error'),
      refetch,
    });
    await renderPage();
    expect(screen.getByText('Unable to load notifications')).toBeTruthy();
    expect(screen.getByText('Please check your connection and try again.')).toBeTruthy();
    const retryButton = screen.getByRole('button', { name: 'Try again' });
    expect(retryButton).toBeTruthy();
  });

  it('calls refetch when the retry button is clicked', async () => {
    const refetch = vi.fn();
    mockUseNotifications.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      error: new Error('Network error'),
      refetch,
    });
    await renderPage();
    const retryButton = screen.getByRole('button', { name: 'Try again' });
    retryButton.click();
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('renders the auth error state when the error is a 401 ApiError', async () => {
    mockUseNotifications.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      error: new ApiError(401, 'unauthorized', 'Unauthorized', null),
    });
    await renderPage();
    expect(screen.getByText('Session expired')).toBeTruthy();
    expect(screen.getByText('Sign in again')).toBeTruthy();
  });

  it('renders the offline state when the browser is offline and data is empty', async () => {
    mockUseOnlineStatus.mockReturnValue(false);
    mockUseNotifications.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
      error: null,
    });
    await renderPage();
    expect(screen.getByText('You are offline')).toBeTruthy();
  });

  it('renders stale data with a refresh warning when error occurs but data exists', async () => {
    mockUseNotifications.mockReturnValue({
      isLoading: false,
      isError: true,
      data: [
        {
          id: 'n-1',
          title: 'Update',
          body: 'Your report was updated',
          channel: 'push',
          read_at: null,
          created_at: '2024-01-01T00:00:00Z',
          data: null,
        },
      ],
      error: new Error('Refresh failed'),
    });
    await renderPage();
    expect(screen.getByText('Showing cached notifications. Could not refresh.')).toBeTruthy();
    expect(screen.getByText('Update')).toBeTruthy();
  });

  it('renders notification items when data is present without error', async () => {
    mockUseNotifications.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        {
          id: 'n-1',
          title: 'Report received',
          body: 'Your report has been submitted',
          channel: 'push',
          read_at: null,
          created_at: '2026-08-01T10:00:00Z',
          data: null,
        },
      ],
      error: null,
    });
    await renderPage();
    expect(screen.getByText('Report received')).toBeTruthy();
    expect(screen.getByText('1 unread')).toBeTruthy();
  });
});
