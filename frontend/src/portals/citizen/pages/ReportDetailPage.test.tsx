import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReportDetail } from '../api/client';

vi.mock('../api/client', () => ({
  useReportDetail: vi.fn(),
  useReportTimeline: vi.fn(() => ({ isLoading: false, error: null, data: [] })),
}));

vi.mock('../components/LocationMap', () => ({
  default: ({ label }: { label?: string | null }) => (
    <div data-testid="location-map">{label ?? 'Location map'}</div>
  ),
}));

import ReportDetailPage from './ReportDetailPage';
import { useReportDetail } from '../api/client';

function baseReport(overrides: Partial<ReportDetail>): ReportDetail {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Pothole on Main St',
    description: 'Deep pothole',
    status: { code: 'open', name: 'Open' },
    media: [],
    timeline: [],
    ...overrides,
  };
}

describe('ReportDetailPage verification badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a "Verified" badge when the report is_verified is true', () => {
    (useReportDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      error: null,
      data: baseReport({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', is_verified: true }),
    });
    render(
      <MemoryRouter initialEntries={['/citizen/reports/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']}>
        <ReportDetailPage />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Verified')).not.toBeNull();
  });

  it('omits the verification badge when is_verified is false', () => {
    (useReportDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      error: null,
      data: baseReport({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', is_verified: false }),
    });
    render(
      <MemoryRouter initialEntries={['/citizen/reports/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']}>
        <ReportDetailPage />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Verified')).toBeNull();
    expect(screen.queryByText('GPS verified')).toBeNull();
  });

  it('omits the verification badge when is_verified is absent', () => {
    (useReportDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      error: null,
      data: baseReport({ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' }),
    });
    render(
      <MemoryRouter initialEntries={['/citizen/reports/cccccccc-cccc-cccc-cccc-cccccccccccc']}>
        <ReportDetailPage />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Verified')).toBeNull();
    expect(screen.queryByText('GPS verified')).toBeNull();
  });
});
