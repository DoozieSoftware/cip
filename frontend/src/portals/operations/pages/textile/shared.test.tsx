import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { OPERATIONS_QUEUE_REFRESH_MS, useTextileQueue } from './shared';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

const QUEUE_ARGS = {
  status: 'scheduled',
  search: '',
  page: 1,
  enabled: true,
  departmentId: 'department-1',
};

describe('useTextileQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes an active officer queue without a manual toolbar action', () => {
    renderHook(() => useTextileQueue({ ...QUEUE_ARGS, autoRefresh: true }));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        refetchInterval: OPERATIONS_QUEUE_REFRESH_MS,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      }),
    );
  });

  it('pauses updates while an officer has unfinished work', () => {
    renderHook(() => useTextileQueue({ ...QUEUE_ARGS, autoRefresh: false }));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        refetchInterval: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      }),
    );
  });
});

describe('StatusBadge', () => {
  it('renders received_at_centre status with clear drop-off label', async () => {
    const { render, screen } = await import('@testing-library/react');
    const { StatusBadge } = await import('./shared');

    render(<StatusBadge status="received_at_centre" />);
    expect(screen.getByText('Drop-off received')).toBeDefined();
  });
});

describe('TripProgressBar', () => {
  it('shows counts by default for board-level progress', async () => {
    const { render, screen } = await import('@testing-library/react');
    const { TripProgressBar } = await import('./shared');

    render(
      <TripProgressBar batchStatus="in_progress" collected={1} missed={0} pending={3} total={4} />,
    );
    expect(screen.getByRole('progressbar')).toBeDefined();
    expect(screen.getByText(/1 of 4/)).toBeDefined();
  });

  it('hides count text but keeps the bar when showCounts is false', async () => {
    const { render, screen } = await import('@testing-library/react');
    const { TripProgressBar } = await import('./shared');

    render(
      <TripProgressBar
        batchStatus="in_progress"
        collected={1}
        missed={0}
        pending={3}
        total={4}
        showCounts={false}
      />,
    );
    expect(screen.getByRole('progressbar')).toBeDefined();
    expect(screen.queryByText(/1 of 4/)).toBeNull();
    expect(screen.queryByText(/3 left/)).toBeNull();
    // Screen readers still get progress through the accessible label.
    expect(screen.getByLabelText(/Trip progress In progress, 1 of 4 collected/)).toBeDefined();
  });
});
describe('Pager', () => {
  it('renders per-page size options when onPerPageChange is provided', async () => {
    const { render, screen, fireEvent } = await import('@testing-library/react');
    const { Pager } = await import('./shared');
    const onPerPageChange = vi.fn();

    render(
      <Pager
        meta={{ page: 1, total: 80, last_page: 4, per_page: 25 }}
        onPage={vi.fn()}
        perPage={25}
        onPerPageChange={onPerPageChange}
      />,
    );

    expect(screen.getByText('Show:')).toBeDefined();
    const btn50 = screen.getByRole('button', { name: '50' });
    fireEvent.click(btn50);
    expect(onPerPageChange).toHaveBeenCalledWith(50);
  });
});
