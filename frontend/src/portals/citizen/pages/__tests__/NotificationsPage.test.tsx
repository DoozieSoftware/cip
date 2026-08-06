import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/client', () => ({
  useNotifications: vi.fn(),
  useMarkNotificationRead: vi.fn(() => ({ mutate: vi.fn() })),
}));

const { useNotifications, useMarkNotificationRead } = await import('../api/client');
const NotificationsPage = (await import('../NotificationsPage')).default;

const NOTIFICATIONS = [
  {
    id: 'n-1',
    title: 'Report status updated',
    body: 'Your report has been assigned',
    read_at: null,
    created_at: '2026-01-01T00:00:00Z',
    channel: 'push',
    data: { report_id: 'r-1' },
  },
  {
    id: 'n-2',
    title: 'Report resolved',
    body: 'Your report has been resolved',
    read_at: '2026-01-02T00:00:00Z',
    created_at: '2026-01-02T00:00:00Z',
    channel: 'email',
    data: null,
  },
];

describe('NotificationsPage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (useNotifications as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: NOTIFICATIONS,
      isLoading: false,
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NotificationsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Notifications')).toBeTruthy();
  });

  it('renders notification items', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NotificationsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Report status updated')).toBeTruthy();
    expect(screen.getByText('Report resolved')).toBeTruthy();
  });

  it('shows unread count', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NotificationsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('1 unread')).toBeTruthy();
  });

  it('shows loading state', () => {
    (useNotifications as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NotificationsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading notifications')).toBeTruthy();
  });

  it('shows empty state when no notifications', () => {
    (useNotifications as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NotificationsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('No notifications')).toBeTruthy();
  });

  it('renders mark as read button for unread', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NotificationsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Mark as read')).toBeTruthy();
  });

  it('calls markRead on click', () => {
    const mutate = vi.fn();
    (useMarkNotificationRead as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ mutate });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NotificationsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText('Mark as read'));
    expect(mutate).toHaveBeenCalledWith('n-1');
  });
});
