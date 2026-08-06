import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAdminReports: vi.fn(() => ({
    data: {
      reports: [
        {
          id: 'report-1',
          tracking_number: 'CIV-2026-000001',
          title: 'Broken water main',
          current_status_code: 'resolved',
          submitted_at: '2026-08-01T10:00:00Z',
          report_type: { id: 'type-1', code: 'water_leakage', name: 'Water leakage' },
          department: { id: 'dept-1', code: 'ROADS', name: 'Roads' },
          assignments: [
            {
              id: 'assignment-1',
              kind: 'secondary' as const,
              is_primary: false,
              task_status: 'open',
              department: { id: 'dept-2', code: 'WATER', name: 'Water' },
              officer: { id: 'user-1', name: 'Water Officer' },
              assigned_at: null,
            },
          ],
        },
      ],
      meta: { page: 1, per_page: 25, total: 1, last_page: 1 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
}));

vi.mock('../../api/client', () => ({
  useAdminReports: mocks.useAdminReports,
  useAdminDepartments: vi.fn(() => ({ data: [{ id: 'dept-1', code: 'ROADS', name: 'Roads' }] })),
  useAdminReportTypes: vi.fn(() => ({
    data: [{ id: 'type-1', code: 'water_leakage', name: 'Water leakage' }],
  })),
  useAdminUsers: vi.fn(() => ({
    data: [{ id: 'user-1', name: 'Water Officer', mobile: '1', roles: ['department_officer'] }],
  })),
}));

const AdminReports = (await import('../AdminReports')).default;

describe('AdminReports', () => {
  beforeEach(() => mocks.useAdminReports.mockClear());

  it('renders cross-department assignment data and sends filter changes to the query', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AdminReports />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: 'All reports' })).toBeTruthy();
    expect(screen.getByText('Broken water main')).toBeTruthy();
    expect(screen.getByText('secondary')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('All assignments'), {
      target: { value: 'secondary' },
    });

    expect(mocks.useAdminReports).toHaveBeenLastCalledWith(
      expect.objectContaining({ assignment_type: 'secondary' }),
    );
  });
});
