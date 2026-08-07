import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../api/moderator', () => ({
  queueApi: {
    show: vi.fn(),
    departments: vi.fn(),
    reportTypes: vi.fn(),
    list: vi.fn(),
  },
  actionsApi: {
    review: vi.fn(),
    reject: vi.fn(),
    merge: vi.fn(),
    escalate: vi.fn(),
    reassign: vi.fn(),
  },
}));

vi.mock('../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('../../../../shared/geo/useReverseGeocode', () => ({
  useReverseGeocode: vi.fn(() => null),
}));

const { queueApi } = await import('../api/moderator');
const ReportDetailPage = (await import('../ReportDetailPage')).default;

function renderPage(id: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/moderator/reports/${id}`]}>
        <Routes>
          <Route path="/moderator/reports/:id" element={<ReportDetailPage />} />
          <Route path="/moderator/queue" element={<div>Queue</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ModeratorReportDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (queueApi.show as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'r-1',
      tracking_number: 'CIP-001',
      title: 'Pothole near metro',
      description: 'Large pothole causing traffic issues',
      status_code: 'pending_moderator',
      submitted_at: '2026-01-01T00:00:00Z',
      category: { id: 'cat-1', name: 'Roads' },
      department: { id: 'dept-1', name: 'BBMP' },
      location: { lat: 12.97, lng: 77.59 },
      ward: 'Ward 1',
      media: [],
      ai_result: null,
      mock_gps_score: null,
      evidence_count: 0,
      audit_log: [],
    });
    (queueApi.departments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (queueApi.reportTypes as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (queueApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
  });

  it('renders the report title', async () => {
    renderPage('r-1');
    expect(await screen.findByText('Pothole near metro')).toBeTruthy();
  });

  it('renders report details', async () => {
    renderPage('r-1');
    expect(await screen.findByText('CIP-001')).toBeTruthy();
    expect(screen.getByText('Large pothole causing traffic issues')).toBeTruthy();
    expect(screen.getByText('Roads')).toBeTruthy();
    expect(screen.getByText('BBMP')).toBeTruthy();
  });

  it('shows loading state', () => {
    (queueApi.show as unknown as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderPage('r-1');
    expect(screen.getByText('Loading report')).toBeTruthy();
  });

  it('shows error state', async () => {
    (queueApi.show as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    renderPage('r-1');
    expect(await screen.findByText('Report not found')).toBeTruthy();
  });

  it('renders approve and reject buttons', async () => {
    renderPage('r-1');
    expect(await screen.findByText('Approve')).toBeTruthy();
    expect(screen.getByText('Reject')).toBeTruthy();
  });

  it('opens approve dialog on click', async () => {
    renderPage('r-1');
    fireEvent.click(await screen.findByText('Approve'));
    expect(await screen.findByText('Approve and forward')).toBeTruthy();
  });
});
