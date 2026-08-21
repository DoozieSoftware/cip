import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import MyReportsPage from '../MyReportsPage';
import { ApiError } from '../../../../shared/api/errors';

const mockUseCitizenReports = vi.fn<(filters?: unknown) => Record<string, unknown>>(() => ({
  isLoading: false,
  isError: false,
  data: {
    data: [],
    meta: { page: 1, per_page: 12, total: 0, last_page: 1 },
  },
  refetch: vi.fn(),
}));

const mockLifecycleGroup = vi.fn<(code?: unknown) => string>(() => 'open');

const mockUseOnlineStatus = vi.fn(() => true);

vi.mock('../../api/client', () => ({
  lifecycleGroup: (code?: unknown) => mockLifecycleGroup(code),
  useCitizenReports: (filters?: unknown) => mockUseCitizenReports(filters),
  useReportTypes: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));

describe('MyReportsPage', () => {
  it('keeps the new report action visibly labeled', () => {
    render(
      <MemoryRouter>
        <MyReportsPage />
      </MemoryRouter>,
    );

    const action = screen.getByRole('link', { name: 'New Complaint' });
    expect(action).toHaveTextContent('New Complaint');
    expect(action.querySelector('span')).toHaveClass('sm:inline');
  });

  it('shows loading state', () => {
    mockUseCitizenReports.mockReturnValueOnce({
      isLoading: true,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MyReportsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'Loading your complaints' })).toBeTruthy();
  });

  it('shows error state when API fails', () => {
    mockUseCitizenReports.mockReturnValueOnce({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MyReportsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Unable to load complaints')).toBeTruthy();
    expect(screen.getByText('Please check your connection and try again.')).toBeTruthy();
  });

  it('retry button calls refetch', () => {
    const refetch = vi.fn();
    mockUseCitizenReports.mockReturnValueOnce({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch,
    });

    render(
      <MemoryRouter>
        <MyReportsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('shows empty state when user has no reports', () => {
    render(
      <MemoryRouter>
        <MyReportsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('No complaints yet')).toBeTruthy();
    expect(
      screen.getByText('File your first service request and track its progress.'),
    ).toBeTruthy();
  });

  it('shows filtered empty state when filter yields no results but reports exist', () => {
    mockLifecycleGroup.mockReturnValueOnce('closed');
    mockUseCitizenReports.mockReturnValueOnce({
      isLoading: false,
      isError: false,
      data: {
        data: [
          {
            id: 'r-1',
            tracking_number: 'CIP-001',
            title: 'Pothole on Main St',
            description: 'Large pothole',
            status: { code: 'closed', name: 'Closed' },
            type: { name: 'Roads' },
            created_at: '2025-01-15T10:00:00Z',
            location: null,
          },
        ],
        meta: { page: 1, per_page: 12, total: 1, last_page: 1 },
      },
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/?status=open']}>
        <MyReportsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('No open complaints')).toBeTruthy();
    expect(
      screen.getByText('You have complaints in other categories. Try a different filter.'),
    ).toBeTruthy();
    expect(screen.getByText('Show all complaints')).toBeTruthy();
  });

  it('shows reports list when data is available', () => {
    mockUseCitizenReports.mockReturnValueOnce({
      isLoading: false,
      isError: false,
      data: {
        data: [
          {
            id: 'r-1',
            tracking_number: 'CIP-001',
            title: 'Pothole on Main St',
            description: 'Large pothole near intersection',
            status: { code: 'submitted', name: 'Submitted' },
            type: { name: 'Roads' },
            created_at: '2025-01-15T10:00:00Z',
            location: null,
          },
          {
            id: 'r-2',
            tracking_number: 'CIP-002',
            title: 'Broken streetlight',
            description: 'Light out on Oak Ave',
            status: { code: 'in_progress', name: 'In Progress' },
            type: { name: 'Lighting' },
            created_at: '2025-01-16T14:30:00Z',
            location: null,
          },
        ],
        meta: { page: 1, per_page: 12, total: 2, last_page: 1 },
      },
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MyReportsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Pothole on Main St')).toBeTruthy();
    expect(screen.getByText('Broken streetlight')).toBeTruthy();
    expect(screen.getByText('2 complaints')).toBeTruthy();

    const title = screen.getByText('Pothole on Main St');
    expect(title.parentElement).toHaveClass('flex-col');
    expect(screen.getByText('Received')).toHaveClass('whitespace-nowrap');
  });

  it('shows auth error state with sign-in link when 401', () => {
    mockUseCitizenReports.mockReturnValueOnce({
      isLoading: false,
      isError: true,
      error: new ApiError(401, 'unauthorized', 'Unauthorized', null),
      data: undefined,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MyReportsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Session expired')).toBeTruthy();
    expect(screen.getByText('Sign in again to see your latest complaints.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in again' })).toBeTruthy();
  });

  it('shows offline state with retry when not online', () => {
    mockUseOnlineStatus.mockReturnValueOnce(false);
    const refetch = vi.fn();
    mockUseCitizenReports.mockReturnValueOnce({
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      data: undefined,
      refetch,
    });

    render(
      <MemoryRouter>
        <MyReportsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('You are offline.')).toBeTruthy();
    expect(screen.getByText('Drafts are saved and will sync when you reconnect.')).toBeTruthy();
    fireEvent.click(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('shows stale-data banner with retry when error occurs with cached data', () => {
    const refetch = vi.fn();
    mockUseCitizenReports.mockReturnValueOnce({
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      data: {
        data: [
          {
            id: 'r-1',
            tracking_number: 'CIP-001',
            title: 'Pothole on Main St',
            description: 'Large pothole',
            status: { code: 'submitted', name: 'Submitted' },
            type: { name: 'Roads' },
            created_at: '2025-01-15T10:00:00Z',
            location: null,
          },
        ],
        meta: { page: 1, per_page: 12, total: 1, last_page: 1 },
      },
      refetch,
    });

    render(
      <MemoryRouter>
        <MyReportsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Showing cached complaints. Could not refresh.')).toBeTruthy();
    expect(screen.getByText('Pothole on Main St')).toBeTruthy();
    fireEvent.click(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('error states have assertive live region for screen readers', () => {
    mockUseCitizenReports.mockReturnValueOnce({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MyReportsPage />
      </MemoryRouter>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });
});
