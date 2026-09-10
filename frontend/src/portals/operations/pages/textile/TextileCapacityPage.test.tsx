import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../../../auth/AuthContext';
import type * as TextileApi from '../../api/textileApi';
import type * as TextileShared from './shared';
import TextileCapacityPage from './TextileCapacityPage';
import { useDesk } from './shared';
import * as textileApi from '../../api/textileApi';

vi.mock('./shared', async () => {
  const actual = await vi.importActual<typeof TextileShared>('./shared');

  return {
    ...actual,
    useDesk: vi.fn(),
  };
});

vi.mock('../../api/textileApi', async () => {
  const actual = await vi.importActual<typeof TextileApi>('../../api/textileApi');

  return {
    ...actual,
    fetchCapacityRules: vi.fn(),
    fetchTextileReportingDashboard: vi.fn(),
    fetchTextileLiveSnapshot: vi.fn(),
    downloadTextileReportingExport: vi.fn(),
    fetchStaffTextileZones: vi.fn(),
  };
});

vi.mock('echarts-for-react', () => ({
  default: (props: { 'aria-label'?: string; style?: React.CSSProperties }) => (
    <div
      data-testid="echarts-chart"
      aria-label={props['aria-label'] ?? 'chart'}
      style={props.style}
    />
  ),
}));

const LIVE = {
  date: '2026-09-09',
  trips: { total: 2, by_status: { in_progress: 1, planned: 1 } },
  stops: { total: 10, pending: 6, collected: 3, missed: 1 },
  pending_receipts: 4,
  failed_uploads: 1,
};

const DASHBOARD = {
  period: { start: '2025-10-01', end: '2026-09-30' },
  totals: {
    requests: 42,
    trips: 5,
    estimated_bags: 100,
    actual_bags: 88,
    estimated_weight_kg: 250,
    actual_weight_kg: 220,
    variance_bags: -12,
    variance_weight_kg: -12,
  },
  breakdowns: {
    status: { pending_review: 2, scheduled: 30, picked_up: 8, missed: 2 },
    collection_method: { dropoff: 12, premises: 30 },
    zone: { Jayanagar: 25, Koramangala: 17 },
    category: { clothes_waste: 30, e_waste: 12 },
  },
  volumes: { dropoff: 12, premises: 30 },
  rates: {
    missed_count: 2,
    missed_rate_pct: 4.8,
    rescheduled_count: 3,
    reschedule_rate_pct: 7.1,
    exception_count: 1,
    exception_approved: 1,
    exception_rate_pct: 2.4,
  },
  timing: { avg_hours_booking_to_update: 30.5 },
  data_quality: {
    missing_estimates: 0,
    has_baseline: false,
    note: 'Insufficient volume for KPI targets — collect a baseline before setting targets.',
  },
  definitions: {
    requests: 'All textile_collection_requests for the partner in the period.',
    trips: 'Count of textile_collection_batches with at least one request for the partner.',
  },
  timeseries: [
    { period: '2026-07', requests: 20, actual_bags: 40, estimated_bags: 48 },
    { period: '2026-08', requests: 22, actual_bags: 48, estimated_bags: 52 },
  ],
};

const RULES = [
  {
    id: 'rule-1',
    service_zone_id: 'zone-1',
    department_id: 'department-1',
    max_bags: 10,
    max_weight_kg: 25,
    max_stops: 15,
    min_bags: 2,
    min_weight_kg: 5,
    guidance_text: 'Leave bags at the gate.',
    category_allowlist: null,
    service_zone: { id: 'zone-1', name: 'Whitefield' },
  },
];

function renderCapacity() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/operations/textile-collections/capacity']}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Routes>
            <Route
              path="/operations/textile-collections/capacity"
              element={<TextileCapacityPage />}
            />
          </Routes>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('TextileCapacityPage dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDesk).mockReturnValue({
      ready: true,
      isDrLinen: true,
      departmentId: 'department-1',
    });
    vi.mocked(textileApi.fetchTextileLiveSnapshot).mockResolvedValue(LIVE);
    vi.mocked(textileApi.fetchTextileReportingDashboard).mockResolvedValue(DASHBOARD);
    vi.mocked(textileApi.fetchCapacityRules).mockResolvedValue(RULES);
    vi.mocked(textileApi.downloadTextileReportingExport).mockResolvedValue(undefined);
    vi.mocked(textileApi.fetchStaffTextileZones).mockResolvedValue([
      {
        id: 'zone-1',
        code: 'JAY',
        name: 'Jayanagar',
        methods: ['dropoff', 'premises'],
        active: true,
        centres: [],
      },
    ]);
  });

  it('renders the live strip first with numbers linking to their queues', async () => {
    renderCapacity();

    expect(await screen.findByRole('link', { name: /Trips today: 2/ })).toHaveAttribute(
      'href',
      '/operations/textile-collections/collections',
    );
    expect(screen.getByRole('link', { name: /Pickups today: 10/ })).toHaveAttribute(
      'href',
      '/operations/textile-collections/collections',
    );
    expect(screen.getByText('6 pending · 3 collected · 1 missed')).toBeVisible();
    expect(screen.getByRole('link', { name: /Pending receipts: 4/ })).toHaveAttribute(
      'href',
      '/operations/textile-collections/pickup-requests',
    );
    expect(screen.getByRole('link', { name: /Failed uploads: 1/ })).toHaveAttribute(
      'href',
      '/operations/textile-collections/offline-recovery',
    );

    // Live strip precedes period analytics in DOM order (mobile shows it first).
    const liveSection = screen.getByLabelText('Live position today', { selector: 'section' });
    const analytics = screen.getByLabelText('Period analytics', { selector: 'section' });
    expect(
      liveSection.compareDocumentPosition(analytics) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps period analytics, charts, and export below the live strip', async () => {
    renderCapacity();

    // Hero metrics.
    expect(await screen.findByText('42')).toBeVisible();
    expect(screen.getByText('220 kg')).toBeVisible();
    expect(screen.getByText('95.2%')).toBeVisible();
    expect(screen.getByText('7.1%')).toBeVisible();
    // Operations charts.
    expect(screen.getByText('Lifecycle Stage Distribution')).toBeVisible();
    expect(screen.getByText('Monthly Volume Progression')).toBeVisible();
    expect(screen.getByText('Collection Method Split')).toBeVisible();
    expect(screen.getByText('Top Service Zones')).toBeVisible();
    // Material Categories and Environmental impact are not present.
    expect(screen.queryByText('Material Categories')).not.toBeInTheDocument();
    expect(screen.queryByText('Circularity & Environmental Impact')).not.toBeInTheDocument();
    // Filter controls.
    expect(screen.getByLabelText('Analytics zone')).toBeVisible();
    expect(screen.queryByLabelText('Analytics category')).not.toBeInTheDocument();
    // Reconciliation note ties cards to the CSV export.
    expect(screen.getByText(/Totals match the CSV export for this period/)).toBeVisible();
    // Breakdowns render mapped labels and click-through links.
    expect(screen.getByRole('link', { name: /Needs review/ })).toHaveAttribute(
      'href',
      '/operations/textile-collections/review',
    );
    expect(screen.getAllByText('Jayanagar')[0]).toBeVisible();
    // Trend periods render.
    expect(screen.getByText('2026-07')).toBeVisible();
    // Data-quality notice kept.
    expect(screen.getByText(/Data quality:/)).toBeVisible();
    // Metric definitions and zone capacity rules removed per design simplification.
    expect(screen.queryByText('Metric definitions')).not.toBeInTheDocument();
    expect(screen.queryByText('Zone capacity rules')).not.toBeInTheDocument();
    // CSV export kept.
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  });

  it('shares the selected period between analytics and the CSV export', async () => {
    renderCapacity();
    await screen.findByRole('button', { name: 'Export CSV' });

    fireEvent.change(screen.getByLabelText('Analytics year'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('Analytics month'), { target: { value: '08' } });

    await vi.waitFor(() => {
      expect(textileApi.fetchTextileReportingDashboard).toHaveBeenCalledWith(
        expect.objectContaining({ year: '2026', month: '08' }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await vi.waitFor(() => {
      expect(textileApi.downloadTextileReportingExport).toHaveBeenCalledWith({
        department_id: 'department-1',
        year: '2026',
        month: '08',
      });
    });
  });

  it('shows an export failure without losing the analytics', async () => {
    vi.mocked(textileApi.downloadTextileReportingExport).mockRejectedValue(new Error('no session'));
    renderCapacity();

    fireEvent.click(await screen.findByRole('button', { name: 'Export CSV' }));
    expect(
      await screen.findByText('Export failed. Check your session and try again.'),
    ).toBeVisible();
    expect(screen.getByText('42')).toBeVisible();
  });

  it('keeps analytics visible when the live strip fails, with a retry', async () => {
    vi.mocked(textileApi.fetchTextileLiveSnapshot).mockRejectedValue(new Error('offline'));
    renderCapacity();

    expect(await screen.findByText("Could not load today's live position.")).toBeVisible();
    const retry = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retry);
    expect(textileApi.fetchTextileLiveSnapshot).toHaveBeenCalledTimes(2);

    // Period analytics still render below the failed strip.
    expect(await screen.findByText('42')).toBeVisible();
  });
});
