import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReportSummary } from '../api/client';

vi.mock('../api/client', () => ({
  useCitizenReports: vi.fn(),
  lifecycleGroup: vi.fn((code: string) => {
    if (code === 'closed' || code === 'verified') return 'closed';
    if (code === 'rejected') return 'rejected';
    if (code === 'merged') return 'merged';
    if (code === 'resolved') return 'awaiting_citizen';
    return 'open';
  }),
}));

import MyReportsPage from './MyReportsPage';
import { useCitizenReports } from '../api/client';

function makeReport(overrides: Partial<ReportSummary>): ReportSummary {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    tracking_number: 'CIV-2026-000001',
    title: 'Test Report',
    description: 'Test description',
    status: { code: 'submitted', name: 'Submitted' },
    created_at: '2026-07-01T10:00:00Z',
    ...overrides,
  };
}

describe('MyReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders real tracking numbers instead of invented CIP- references', () => {
    (useCitizenReports as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          makeReport({
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            tracking_number: 'CIV-2026-00042',
          }),
          makeReport({
            id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            tracking_number: 'CIV-2026-00099',
          }),
        ],
        meta: { page: 1, per_page: 12, total: 2, last_page: 1 },
      },
    });

    render(
      <MemoryRouter initialEntries={['/citizen/reports']}>
        <MyReportsPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText('CIV-2026-00042')).not.toBeNull();
    expect(screen.queryByText('CIV-2026-00099')).not.toBeNull();
    expect(screen.queryByText(/CIP-/)).toBeNull();
  });

  it('filters reports by lifecycle group', () => {
    (useCitizenReports as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          makeReport({
            id: '1',
            status: { code: 'submitted', name: 'Submitted' },
            tracking_number: 'CIV-2026-000001',
          }),
          makeReport({
            id: '2',
            status: { code: 'closed', name: 'Closed' },
            tracking_number: 'CIV-2026-000002',
          }),
          makeReport({
            id: '3',
            status: { code: 'rejected', name: 'Rejected' },
            tracking_number: 'CIV-2026-000003',
          }),
          makeReport({
            id: '4',
            status: { code: 'merged', name: 'Merged' },
            tracking_number: 'CIV-2026-000004',
          }),
          makeReport({
            id: '5',
            status: { code: 'resolved', name: 'Resolved' },
            tracking_number: 'CIV-2026-000005',
          }),
        ],
        meta: { page: 1, per_page: 12, total: 5, last_page: 1 },
      },
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/citizen/reports?status=closed']}>
        <MyReportsPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText('CIV-2026-000002')).not.toBeNull();
    expect(screen.queryByText('CIV-2026-000001')).toBeNull();
    expect(screen.queryByText('CIV-2026-000003')).toBeNull();

    rerender(
      <MemoryRouter initialEntries={['/citizen/reports?status=rejected']}>
        <MyReportsPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText('CIV-2026-000003')).not.toBeNull();
    expect(screen.queryByText('CIV-2026-000001')).toBeNull();
    expect(screen.queryByText('CIV-2026-000002')).toBeNull();
  });

  it('does not misclassify accepted/rejected/merged as closed', () => {
    (useCitizenReports as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          makeReport({
            id: '1',
            status: { code: 'accepted', name: 'Accepted' },
            tracking_number: 'CIV-2026-000001',
          }),
          makeReport({
            id: '2',
            status: { code: 'rejected', name: 'Rejected' },
            tracking_number: 'CIV-2026-000002',
          }),
          makeReport({
            id: '3',
            status: { code: 'merged', name: 'Merged' },
            tracking_number: 'CIV-2026-000003',
          }),
        ],
        meta: { page: 1, per_page: 12, total: 3, last_page: 1 },
      },
    });

    render(
      <MemoryRouter initialEntries={['/citizen/reports?status=closed']}>
        <MyReportsPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText('CIV-2026-000001')).toBeNull();
    expect(screen.queryByText('CIV-2026-000002')).toBeNull();
    expect(screen.queryByText('CIV-2026-000003')).toBeNull();
  });
});
