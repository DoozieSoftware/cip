import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { departmentApi } from '../../api/operations';
import { DepartmentSelectionProvider } from '../../context/DepartmentSelectionContext';
import type { DepartmentReportDetail } from '../../types';
import ReportDetailPage from '../ReportDetailPage';

vi.mock('../../api/operations', () => ({
  departmentApi: {
    showReport: vi.fn(),
    showReportInDepartment: vi.fn(),
    action: vi.fn(),
    completeTask: vi.fn(),
    memberships: vi.fn(),
    listNotes: vi.fn(),
    addNote: vi.fn(),
    uploadProof: vi.fn(),
  },
}));

const REPORT_ID = '11111111-1111-1111-1111-111111111111';

function baseReport(overrides: Partial<DepartmentReportDetail> = {}): DepartmentReportDetail {
  return {
    id: REPORT_ID,
    tracking_number: 'CIP-2026-0001',
    workflow_version: 1,
    title: 'Pothole on Main St',
    description: 'Deep pothole near the junction',
    is_anonymous: false,
    is_verified: false,
    ai_confidence: null,
    fraud_score: null,
    duplicate_score: null,
    submitted_at: '2026-08-01T09:00:00+05:30',
    closed_at: null,
    created_at: '2026-08-01T09:00:00+05:30',
    updated_at: '2026-08-01T09:00:00+05:30',
    report_type: { id: 'rt-1', code: 'road', name: 'Roads' },
    status: null,
    priority: { id: 'p-1', code: 'high', name: 'High', sla_minutes: 120 },
    location: { lat: 12.9716, lng: 77.5946, accuracy: 12, address: 'Main St, Bengaluru' },
    department: null,
    current_status_code: 'assigned',
    department_sla_minutes: 120,
    internal_notes: [],
    media: [],
    proof_verifications: [],
    status_history: [],
    assigned_to: null,
    assignment: null,
    assignments: [],
    ...overrides,
  };
}

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <DepartmentSelectionProvider>
        <MemoryRouter initialEntries={[`/operations/reports/${REPORT_ID}`]}>
          <Routes>
            <Route path="/operations/reports/:id" element={ui} />
          </Routes>
        </MemoryRouter>
      </DepartmentSelectionProvider>
    </QueryClientProvider>,
  );
}

function renderPage(report: DepartmentReportDetail) {
  vi.mocked(departmentApi.memberships).mockResolvedValue([
    { id: 'dept-1', code: 'BBMP', name: 'BBMP' },
  ]);
  vi.mocked(departmentApi.showReportInDepartment).mockResolvedValue(report);
  vi.mocked(departmentApi.listNotes).mockResolvedValue([]);
  vi.mocked(departmentApi.action).mockResolvedValue(report);
  vi.mocked(departmentApi.completeTask).mockResolvedValue(report);
  renderWithClient(<ReportDetailPage />);
}

describe('OperationsReportDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders the report title and tracking number', async () => {
    renderPage(baseReport());
    expect(await screen.findByText('Pothole on Main St')).toBeTruthy();
    expect(screen.getAllByText('CIP-2026-0001').length).toBeGreaterThan(0);
  });

  it('shows loading state while fetching', () => {
    vi.mocked(departmentApi.memberships).mockResolvedValue([
      { id: 'dept-1', code: 'BBMP', name: 'BBMP' },
    ]);
    vi.mocked(departmentApi.showReportInDepartment).mockReturnValue(new Promise(() => {}));
    vi.mocked(departmentApi.listNotes).mockResolvedValue([]);
    renderWithClient(<ReportDetailPage />);
    expect(screen.getByLabelText('Loading report')).toBeTruthy();
  });

  it('shows error state when the report fails to load', async () => {
    vi.mocked(departmentApi.memberships).mockResolvedValue([
      { id: 'dept-1', code: 'BBMP', name: 'BBMP' },
    ]);
    vi.mocked(departmentApi.showReportInDepartment).mockRejectedValue(
      new Error('backend unreachable'),
    );
    vi.mocked(departmentApi.listNotes).mockResolvedValue([]);
    renderWithClient(<ReportDetailPage />);
    expect(await screen.findByText('Report not found')).toBeTruthy();
  });

  it('shows empty evidence state when no media is attached', async () => {
    renderPage(baseReport());
    expect(await screen.findByText('No evidence')).toBeTruthy();
    expect(
      screen.getByText(
        'Upload proof photos from the fixed location after the field crew completes the work.',
      ),
    ).toBeTruthy();
  });

  it('renders evidence and proof media in separate galleries', async () => {
    renderPage(
      baseReport({
        media: [
          {
            id: 'm1',
            assignment_id: null,
            department_id: null,
            type: 'image',
            role: 'evidence',
            mime: 'image/jpeg',
            url: 'https://example.test/e1.jpg',
            width: 800,
            height: 600,
            created_at: '2026-08-01T10:00:00+05:30',
          },
          {
            id: 'm3',
            assignment_id: null,
            department_id: null,
            type: 'image',
            role: 'proof',
            mime: 'image/png',
            url: 'https://example.test/p1.png',
            width: 800,
            height: 600,
            created_at: '2026-08-02T10:00:00+05:30',
          },
        ],
      }),
    );

    const evidenceImg = await screen.findByRole('img', { name: 'Citizen evidence 1' });
    expect(evidenceImg).toHaveAttribute('src', 'https://example.test/e1.jpg');

    const proofImg = screen.getByRole('img', { name: 'Proof of completion 1' });
    expect(proofImg).toHaveAttribute('src', 'https://example.test/p1.png');
  });

  it('renders the Due target chip when Due target is configured', async () => {
    renderPage(baseReport());
    expect(await screen.findAllByText(/Overdue by|Due in|On time/)).not.toHaveLength(0);
  });
});
