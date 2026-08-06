import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/client', () => ({
  useFeatureFlags: vi.fn(),
  useToggleFeatureFlag: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

const { useFeatureFlags, useToggleFeatureFlag } = await import('../api/client');
const AdminFeatureFlags = (await import('../AdminFeatureFlags')).default;

const FLAGS = [
  {
    id: 'f1',
    key: 'ai_classification',
    description: 'Enable AI report classification',
    enabled: true,
    rollout_percentage: 100,
  },
  {
    id: 'f2',
    key: 'push_notifications',
    description: 'Enable push notifications',
    enabled: false,
    rollout_percentage: 50,
  },
];

describe('AdminFeatureFlags', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (useFeatureFlags as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: FLAGS,
      isLoading: false,
      isError: false,
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminFeatureFlags />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Feature flags')).toBeTruthy();
  });

  it('renders flag list with status badges', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminFeatureFlags />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('ai_classification')).toBeTruthy();
    expect(screen.getByText('push_notifications')).toBeTruthy();
    expect(screen.getByText('enabled')).toBeTruthy();
    expect(screen.getByText('disabled')).toBeTruthy();
  });

  it('shows empty state when no flags', () => {
    (useFeatureFlags as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminFeatureFlags />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('No flags')).toBeTruthy();
  });

  it('shows loading state', () => {
    (useFeatureFlags as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminFeatureFlags />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading flags')).toBeTruthy();
  });

  it('shows error state with retry', () => {
    (useFeatureFlags as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('fail'),
      refetch: vi.fn(),
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminFeatureFlags />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Failed to load feature flags')).toBeTruthy();
  });

  it('filters flags by search', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminFeatureFlags />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const search = screen.getByPlaceholderText('Search flags…');
    fireEvent.change(search, { target: { value: 'push' } });
    expect(screen.getByText('push_notifications')).toBeTruthy();
    expect(screen.queryByText('ai_classification')).toBeNull();
  });

  it('calls toggle on flag click', () => {
    const mutate = vi.fn();
    (useToggleFeatureFlag as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate,
      isPending: false,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminFeatureFlags />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const onButtons = screen.getAllByText('● On');
    fireEvent.click(onButtons[0]);
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'ai_classification', enabled: false }),
      undefined,
    );
  });
});
