import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { departmentApi } from '../api/operations';
import { DepartmentSelectionProvider } from '../context/DepartmentSelectionContext';
import { computeSlaLabel } from '../components/slaInfo';
import type { DepartmentReportDetail } from '../types';
import ReportDetailPage from './ReportDetailPage';

vi.mock('../api/operations', () => ({
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

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ReportDetailPage', () => {
  it('shows a loading state while the report is being fetched', () => {
    vi.mocked(departmentApi.memberships).mockResolvedValue([
      { id: 'dept-1', code: 'BBMP', name: 'BBMP' },
    ]);
    vi.mocked(departmentApi.showReportInDepartment).mockReturnValue(new Promise(() => {}));
    vi.mocked(departmentApi.listNotes).mockResolvedValue([]);
    renderWithClient(<ReportDetailPage />);
    expect(screen.getByLabelText('Loading report')).toBeInTheDocument();
  });

  it('shows an error state with retry when the report fails to load', async () => {
    vi.mocked(departmentApi.memberships).mockResolvedValue([
      { id: 'dept-1', code: 'BBMP', name: 'BBMP' },
    ]);
    vi.mocked(departmentApi.showReportInDepartment).mockRejectedValue(
      new Error('backend unreachable'),
    );
    vi.mocked(departmentApi.listNotes).mockResolvedValue([]);
    renderWithClient(<ReportDetailPage />);
    expect(await screen.findByText('Report could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows an empty state when the citizen attached no evidence', async () => {
    renderPage(baseReport());
    expect(await screen.findByText('No evidence')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Click or drop proof photos from the fixed location after the field crew completes the work.',
      ),
    ).toBeInTheDocument();
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
            id: 'm2',
            assignment_id: null,
            department_id: null,
            type: 'video',
            role: 'evidence',
            mime: 'video/mp4',
            url: 'https://example.test/e2.mp4',
            width: null,
            height: null,
            created_at: null,
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

    const videoLink = screen.getByRole('link', { name: /video\/mp4/ });
    expect(videoLink).toHaveAttribute('href', 'https://example.test/e2.mp4');
    expect(videoLink).toHaveAttribute('target', '_blank');
    expect(videoLink).toHaveAttribute('rel', 'noreferrer');

    const proofImg = screen.getByRole('img', { name: 'Proof of completion 1' });
    expect(proofImg).toHaveAttribute('src', 'https://example.test/p1.png');
    expect(screen.queryByRole('img', { name: 'Citizen evidence 2' })).toBeNull();
  });

  it('shows the Due target chip when the department Due target is configured', async () => {
    renderPage(baseReport());
    expect(await screen.findAllByText(/Overdue by/)).not.toHaveLength(0);
  });

  it('shows primary and linked departments on a multi-department report', async () => {
    renderPage(
      baseReport({
        assignments: [
          {
            id: 'primary-assignment',
            department_id: 'dept-1',
            department: { id: 'dept-1', code: 'BBMP', name: 'BBMP Engineering' },
            is_primary: true,
            kind: 'primary',
            status: 'open',
            sla_minutes: 1440,
            assigned_at: '2026-08-01T09:00:00+05:30',
            accepted_at: null,
            completed_at: null,
            officer: { id: 'officer-1', name: 'Deepa' },
          },
          {
            id: 'linked-assignment',
            department_id: 'dept-2',
            department: { id: 'dept-2', code: 'BESCOM', name: 'BESCOM' },
            is_primary: false,
            kind: 'secondary',
            status: 'open',
            sla_minutes: 480,
            assigned_at: '2026-08-01T09:00:00+05:30',
            accepted_at: null,
            completed_at: null,
            officer: { id: 'officer-2', name: 'Ravi' },
          },
        ],
      }),
    );

    expect(await screen.findByText('Cross-agency departments')).toBeInTheDocument();
    expect(screen.getByText('Primary — owns closure')).toBeInTheDocument();
    expect(screen.getByText('Cross-agency — assists the fix')).toBeInTheDocument();
    expect(screen.getByText('Deepa')).toBeInTheDocument();
    expect(screen.getByText('Ravi')).toBeInTheDocument();
  });

  it('hides the proof upload control for terminal reports', async () => {
    renderPage(baseReport({ current_status_code: 'closed' }));
    expect(await screen.findByRole('heading', { name: 'Pothole on Main St' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Proof photo input')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Upload proof photos' })).toBeNull();
  });

  it('requires a note before confirming progress, then passes it to the action', async () => {
    renderPage(baseReport({ current_status_code: 'in_progress' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Add progress update' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: 'Save update' });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Note (required)'), {
      target: { value: 'On site, crew dispatched to fill the pothole' },
    });
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    await waitFor(() =>
      expect(departmentApi.action).toHaveBeenCalledWith(
        REPORT_ID,
        'progress',
        'On site, crew dispatched to fill the pothole',
        1,
        'dept-1',
      ),
    );
  });

  it('lets accept confirm instantly without a note', async () => {
    renderPage(baseReport());

    fireEvent.click(await screen.findByRole('button', { name: 'Accept assignment' }));
    const confirm = await screen.findByRole('button', { name: 'Accept' });
    expect(confirm).toBeEnabled();
    expect(screen.queryByLabelText('Note (required)')).toBeNull();

    fireEvent.click(confirm);
    await waitFor(() =>
      expect(departmentApi.action).toHaveBeenCalledWith(
        REPORT_ID,
        'accept',
        undefined,
        1,
        'dept-1',
      ),
    );
  });

  it('only shows actions valid for the current workflow stage', async () => {
    renderPage(baseReport({ current_status_code: 'in_progress' }));

    expect(await screen.findByRole('button', { name: 'Add progress update' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as fixed' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept assignment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start field work' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Complete report' })).toBeNull();
  });

  it('keeps secondary tasks out of the report workflow and completes the task safely', async () => {
    const assignment = {
      id: 'assignment-1',
      department_id: 'dept-1',
      is_primary: false,
      kind: 'secondary' as const,
      status: 'open' as const,
      sla_minutes: 480,
      assigned_at: '2026-08-01T09:00:00+05:30',
      accepted_at: null,
      completed_at: null,
      officer: null,
    };
    renderPage(
      baseReport({
        assignment,
        media: [
          {
            id: 'proof-1',
            assignment_id: 'assignment-1',
            department_id: 'dept-1',
            type: 'image',
            role: 'proof',
            mime: 'image/jpeg',
            url: 'https://example.test/proof.jpg',
            width: 800,
            height: 600,
            created_at: '2026-08-02T10:00:00+05:30',
          },
        ],
      }),
    );

    expect(await screen.findAllByText('Cross-agency report')).not.toHaveLength(0);
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept assignment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark as fixed' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Mark task complete' }));
    fireEvent.change(await screen.findByLabelText('Note (required)'), {
      target: { value: 'Traffic control completed.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Complete task' }));

    await waitFor(() =>
      expect(departmentApi.completeTask).toHaveBeenCalledWith(
        REPORT_ID,
        'assignment-1',
        'Traffic control completed.',
        'dept-1',
      ),
    );
  });

  it('uploads proof photos and refetches the report', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) =>
          success({
            coords: {
              latitude: 12.9716,
              longitude: 77.5946,
              accuracy: 9,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: new Date('2026-08-02T10:00:00+05:30').getTime(),
          } as GeolocationPosition),
        ),
      },
    });
    renderPage(baseReport());
    const file = new File(['x'], 'after-fix.jpg', { type: 'image/jpeg' });
    vi.mocked(departmentApi.uploadProof).mockResolvedValue({ media: [] });

    const input = await screen.findByLabelText('Proof photo input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(departmentApi.uploadProof).toHaveBeenCalledWith(
        REPORT_ID,
        [file],
        {
          latitude: 12.9716,
          longitude: 77.5946,
          accuracy: 9,
          altitude: null,
          heading: null,
          speed: null,
          timestamp: '2026-08-02T04:30:00.000Z',
        },
        undefined,
        'dept-1',
      ),
    );
    await waitFor(() => expect(departmentApi.showReportInDepartment).toHaveBeenCalledTimes(2));
  });
});

describe('computeSlaLabel', () => {
  const now = new Date('2026-08-01T12:00:00+05:30').getTime();

  it('returns null when no Due target is configured', () => {
    expect(computeSlaLabel('2026-08-01T09:00:00+05:30', null, 'assigned', now)).toBeNull();
    expect(computeSlaLabel(null, 120, 'assigned', now)).toBeNull();
    expect(computeSlaLabel('2026-08-01T09:00:00+05:30', 0, 'assigned', now)).toBeNull();
  });

  it('reports full hours left while the deadline is ahead', () => {
    expect(computeSlaLabel('2026-08-01T09:00:00+05:30', 120, 'assigned', now)).toBe(
      'Overdue by 1 hour',
    );
    expect(
      computeSlaLabel(
        '2026-08-01T09:00:00+05:30',
        120,
        'assigned',
        new Date('2026-08-01T09:30:00+05:30').getTime(),
      ),
    ).toBe('Due in 2 hours');
  });

  it('reports overdue hours once the deadline has passed', () => {
    expect(computeSlaLabel('2026-08-01T07:00:00+05:30', 120, 'in_progress', now)).toBe(
      'Overdue by 3 hours',
    );
  });

  it('treats resolved and closed reports as meeting the Due target', () => {
    expect(computeSlaLabel('2026-08-01T07:00:00+05:30', 120, 'resolved', now)).toBe('On time');
    expect(computeSlaLabel('2026-08-01T07:00:00+05:30', 120, 'closed', now)).toBe('On time');
  });
});
