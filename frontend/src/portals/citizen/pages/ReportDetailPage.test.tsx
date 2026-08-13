import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReportDetail } from '../api/client';

vi.mock('../api/client', () => ({
  useReportDetail: vi.fn(),
  useReportTimeline: vi.fn(() => ({ isLoading: false, error: null, data: [] })),
  useVerifyResolution: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDisputeResolution: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useMergeDispute: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  lifecycleGroup: vi.fn((code: string) => {
    if (code === 'closed' || code === 'verified') return 'closed';
    if (code === 'rejected') return 'rejected';
    if (code === 'merged') return 'merged';
    return 'open';
  }),
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
    tracking_number: 'CIV-2026-000001',
    workflow_version: 1,
    title: 'Pothole on Main St',
    description: 'Deep pothole',
    status: { code: 'open', name: 'Open' },
    media: [],
    timeline: [],
    ...overrides,
  };
}

describe('ReportDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the real tracking number instead of an invented reference', () => {
    (useReportDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      error: null,
      data: baseReport({ tracking_number: 'CIV-2026-00042' }),
    });
    render(
      <MemoryRouter initialEntries={['/citizen/reports/11111111-1111-1111-1111-111111111111']}>
        <ReportDetailPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByText('CIV-2026-00042').length).toBeGreaterThan(0);
    expect(screen.queryByText(/REF-/)).toBeNull();
  });

  it('shows "Received" badge for newly submitted status', () => {
    (useReportDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      error: null,
      data: baseReport({ status: { code: 'submitted', name: 'Submitted' } }),
    });
    render(
      <MemoryRouter initialEntries={['/citizen/reports/11111111-1111-1111-1111-111111111111']}>
        <ReportDetailPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByText('Received').length).toBeGreaterThan(0);
  });

  it('shows "Completed" badge for closed status', () => {
    (useReportDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      error: null,
      data: baseReport({ status: { code: 'closed', name: 'Closed' } }),
    });
    render(
      <MemoryRouter initialEntries={['/citizen/reports/11111111-1111-1111-1111-111111111111']}>
        <ReportDetailPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
  });

  it('shows "Rejected" badge for rejected status', () => {
    (useReportDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      error: null,
      data: baseReport({ status: { code: 'rejected', name: 'Rejected' } }),
    });
    render(
      <MemoryRouter initialEntries={['/citizen/reports/11111111-1111-1111-1111-111111111111']}>
        <ReportDetailPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByText('Could not accept').length).toBeGreaterThan(0);
  });

  it('renders video evidence with a video element instead of an image placeholder', () => {
    (useReportDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      error: null,
      data: baseReport({
        media: [{ id: 'video-1', kind: 'video', signed_url: 'https://example.test/evidence.mp4' }],
      }),
    });
    render(
      <MemoryRouter initialEntries={['/citizen/reports/11111111-1111-1111-1111-111111111111']}>
        <ReportDetailPage />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Video evidence').tagName).toBe('VIDEO');
    expect(screen.queryByText('No evidence')).toBeNull();
  });
});
