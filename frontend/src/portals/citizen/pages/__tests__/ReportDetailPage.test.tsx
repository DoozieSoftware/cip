import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReportDetail } from '../../api/client';

vi.mock('../../../../auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'u-1', name: 'Jane Doe', mobile: '+919999999999' },
    token: 'mock-token',
    isAuthenticated: true,
    hasAnyRole: vi.fn(() => false),
    logout: vi.fn(),
    login: vi.fn(),
    loading: false,
  })),
}));

vi.mock('../../../../auth/api', () => ({
  apiRequest: vi.fn(),
  ApiEnvelope: {},
}));

vi.mock('../../api/client', () => ({
  useReportDetail: vi.fn(),
  useReportTimeline: vi.fn(() => ({ isLoading: false, error: null, data: [] })),
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

vi.mock('../components/StatusBadge', () => ({
  StatusBadge: ({ status }: { status: { code: string; name?: string } }) => (
    <span data-testid="status-badge">{status.name ?? status.code}</span>
  ),
}));

vi.mock('../../moderator/design/cx', () => ({
  cx: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

const { useReportDetail } = await import('../../api/client');
const ReportDetailPage = (await import('../ReportDetailPage')).default;

function baseReport(overrides: Partial<ReportDetail>): ReportDetail {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    tracking_number: 'CIV-2026-000001',
    title: 'Pothole on Main St',
    description: 'Deep pothole',
    status: { code: 'open', name: 'Open' },
    media: [],
    timeline: [],
    ...overrides,
  };
}

describe('CitizenReportDetailPage', () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the report title and tracking number', async () => {
    (useReportDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      error: null,
      data: baseReport({ tracking_number: 'CIV-2026-00042' }),
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/citizen/reports/11111111-1111-1111-1111-111111111111']}>
          <ReportDetailPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Pothole on Main St')).toBeTruthy();
    expect(screen.getByText('CIV-2026-00042')).toBeTruthy();
  });

  it('shows loading state while fetching', () => {
    (useReportDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: true,
      error: null,
      data: undefined,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/citizen/reports/11111111-1111-1111-1111-111111111111']}>
          <ReportDetailPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading official record')).toBeTruthy();
  });

  it('shows error state when the report fails to load', async () => {
    (useReportDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      error: new Error('Network error'),
      data: undefined,
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/citizen/reports/11111111-1111-1111-1111-111111111111']}>
          <ReportDetailPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Record Not Found')).toBeTruthy();
  });

  it('shows empty evidence state when no media is attached', async () => {
    (useReportDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      error: null,
      data: baseReport({ media: [] }),
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/citizen/reports/11111111-1111-1111-1111-111111111111']}>
          <ReportDetailPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('No Evidence Attached')).toBeTruthy();
  });

  it('renders evidence when media is present', async () => {
    (useReportDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      error: null,
      data: baseReport({
        media: [
          {
            id: 'm-1',
            kind: 'photo',
            signed_url: 'https://example.test/photo.jpg',
            url: 'https://example.test/photo.jpg',
          },
        ],
      }),
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/citizen/reports/11111111-1111-1111-1111-111111111111']}>
          <ReportDetailPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Evidence')).toBeTruthy();
  });

  it('renders status badges based on lifecycle group', async () => {
    (useReportDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      error: null,
      data: baseReport({ status: { code: 'closed', name: 'Closed' } }),
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/citizen/reports/11111111-1111-1111-1111-111111111111']}>
          <ReportDetailPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Closed')).toBeTruthy();
  });
});
