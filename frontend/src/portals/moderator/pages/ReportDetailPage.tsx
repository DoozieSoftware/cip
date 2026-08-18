import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useState, useCallback, useMemo, useEffect, type JSX } from 'react';
import {
  IconArrowLeft,
  IconCheck,
  IconX,
  IconGitMerge,
  IconArrowUp,
  IconUserShare,
  IconMapPin,
  IconCategory,
  IconBuilding,
  IconPhoto,
  IconClock,
  IconClipboardCheck,
  IconChevronDown,
} from '@tabler/icons-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  EmptyState,
  Input,
  Select,
  Spinner,
  Textarea,
} from '../../../shared/ui';
import { reportStatusTone, staffReportStatusLabel } from '../../../shared/statusDisplay';
import { actionsApi, queueApi } from '../api/moderator';
import type {
  MergePayload,
  ProofReview,
  ReportDetail,
  ReportStatusCode,
  ReviewPayload,
} from '../types';
import { EvidenceViewer } from '../components/EvidenceViewer';
import { useReverseGeocode } from '../../../shared/geo/useReverseGeocode';
import { AiAnalysisPanel } from '../components/AiAnalysisPanel';
import { AssignmentDialog } from '../components/AssignmentDialog';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { StepTimeline } from '../../../shared/components/StepTimeline';
import { buildStaffTimeline } from '../../../shared/staffStatusTimeline';
import { moderatorActionMessage } from './moderatorStatus';

function LocationText({ lat, lng }: { lat: number; lng: number }): JSX.Element {
  const place = useReverseGeocode(lat, lng);
  return <>{place || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</>;
}

export function ModeratorReportHeader({
  data,
}: {
  data: Pick<
    ReportDetail,
    'tracking_number' | 'title' | 'submitted_at' | 'status_code' | 'evidence_count'
  >;
}): JSX.Element {
  return (
    <header>
      <Link
        to="/moderator/queue"
        className="inline-flex min-h-[44px] items-center gap-2 text-sm text-[#6f6e69] transition hover:text-[#1d1d1b]"
      >
        <IconArrowLeft className="h-4 w-4" stroke={1.6} />
        Back to review reports
      </Link>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="w-full min-w-0 sm:flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#85847f]">
            {data.tracking_number}
          </p>
          <h1 className="mt-2 w-full break-words text-2xl font-medium tracking-[-0.02em] text-[#1d1d1b]">
            {data.title}
          </h1>
          <p className="mt-2 text-sm text-[#6f6e69]">
            Submitted {new Date(data.submitted_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
              reportStatusTone(data.status_code) === 'warning'
                ? 'bg-amber-50 text-amber-700'
                : reportStatusTone(data.status_code) === 'danger'
                  ? 'bg-violet-50 text-violet-700'
                  : reportStatusTone(data.status_code) === 'success'
                    ? 'bg-emerald-50 text-emerald-700'
                    : reportStatusTone(data.status_code) === 'info'
                      ? 'bg-sky-50 text-sky-700'
                      : 'bg-slate-50 text-slate-700'
            }`}
          >
            {staffReportStatusLabel(data.status_code)}
          </span>
          {data.evidence_count > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs text-[#6f6e69] ring-1 ring-[#d8d6cf]">
              <IconPhoto className="h-3.5 w-3.5" stroke={1.6} />
              {data.evidence_count} evidence
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

const REJECT_REASONS = [
  { value: 'invalid_evidence', label: 'Invalid evidence' },
  { value: 'duplicate', label: 'Duplicate of another report' },
  { value: 'fraudulent', label: 'Misrepresentation' },
  { value: 'out_of_scope', label: 'Out of platform scope' },
  { value: 'incomplete', label: 'Incomplete information' },
];

const ESCALATE_REASONS = [
  { value: 'senior_review', label: 'Senior review needed' },
  { value: 'legal_review', label: 'Legal review needed' },
  { value: 'media_attention', label: 'Media / political attention' },
];

const MODERATION_OPEN_STATES: ReportStatusCode[] = [
  'submitted',
  'ai_processing',
  'pending_moderator',
  'escalated',
];

function shouldRefreshReport(data: ReportDetail | undefined): boolean {
  if (!data) return true;

  return (
    data.status_code === 'submitted' ||
    data.status_code === 'ai_processing' ||
    (data.status_code === 'pending_moderator' && data.ai_result === null)
  );
}

function ActionFooter({
  statusCode,
  onApprove,
  onReject,
  onMerge,
  onEscalate,
  onCompleteProof,
  proofReview,
  onAssign,
  busy,
}: {
  statusCode: ReportStatusCode;
  onApprove: () => void;
  onReject: () => void;
  onMerge: () => void;
  onEscalate: () => void;
  onCompleteProof: () => void;
  proofReview: ProofReview | null;
  onAssign: () => void;
  busy: boolean;
}) {
  const decisionsEnabled = MODERATION_OPEN_STATES.includes(statusCode);
  const proofReviewEnabled = statusCode === 'resolved_pending_verification' && proofReview !== null;

  return (
    <div className="space-y-3" role="group" aria-label="Moderation actions">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="success"
          size="md"
          onClick={onApprove}
          disabled={busy || !decisionsEnabled}
          aria-keyshortcuts="A"
          leftIcon={<IconCheck className="h-4 w-4" stroke={1.8} />}
          className="min-w-28 disabled:opacity-100"
        >
          Approve
        </Button>
        {proofReviewEnabled ? (
          <Button
            variant="success"
            size="sm"
            onClick={onCompleteProof}
            disabled={busy}
            leftIcon={<IconClipboardCheck className="h-4 w-4" stroke={1.6} />}
          >
            Complete after proof review
          </Button>
        ) : null}
        <Button
          variant="danger"
          size="md"
          onClick={onReject}
          disabled={busy || !decisionsEnabled}
          aria-keyshortcuts="R"
          leftIcon={<IconX className="h-4 w-4" stroke={1.8} />}
          className="min-w-28 disabled:opacity-100"
        >
          Reject
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onMerge}
          disabled={busy || !decisionsEnabled}
          aria-keyshortcuts="M"
          leftIcon={<IconGitMerge className="h-4 w-4" stroke={1.6} />}
        >
          Merge
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onEscalate}
          disabled={busy || !decisionsEnabled}
          aria-keyshortcuts="E"
          leftIcon={<IconArrowUp className="h-4 w-4" stroke={1.6} />}
        >
          Escalate
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onAssign}
          disabled={busy}
          aria-keyshortcuts="T"
          leftIcon={<IconUserShare className="h-4 w-4" stroke={1.6} />}
        >
          Reassign
        </Button>
      </div>
      {!decisionsEnabled && !proofReviewEnabled && (
        <p className="text-sm text-[#6f6e69]" role="status">
          {moderatorActionMessage(statusCode)}
        </p>
      )}
    </div>
  );
}

export default function ReportDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery<ReportDetail>({
    queryKey: ['moderator', 'reports', id],
    queryFn: () => queueApi.show(id),
    enabled: Boolean(id),
    refetchInterval: (query) => (shouldRefreshReport(query.state.data) ? 3_000 : false),
  });

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [completeProofOpen, setCompleteProofOpen] = useState(false);

  const [remarks, setRemarks] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [overrideAi, setOverrideAi] = useState(false);
  const [duplicateIds, setDuplicateIds] = useState('');
  const [auditExpanded, setAuditExpanded] = useState(false);

  const departmentsQuery = useQuery({
    queryKey: ['moderator', 'departments'],
    queryFn: () => queueApi.departments(),
  });
  const reportTypesQuery = useQuery({
    queryKey: ['moderator', 'report-types'],
    queryFn: () => queueApi.reportTypes(),
  });
  const departmentOptions = (departmentsQuery.data ?? []).map((d) => ({
    value: d.id,
    label: d.name,
  }));
  const categoryOptions = (reportTypesQuery.data ?? []).map((t) => ({
    value: t.id,
    label: t.name,
  }));

  const aiCategoryName = data?.ai_result?.recommended_category?.name;
  const aiDepartmentName = data?.ai_result?.recommended_department?.name;
  const categoryPlaceholder = aiCategoryName
    ? `Keep AI suggestion: ${aiCategoryName}`
    : 'Keep current category';
  const departmentPlaceholder = aiDepartmentName
    ? `Keep AI suggestion: ${aiDepartmentName}`
    : 'Keep current department';

  useEffect(() => {
    setApproveOpen(false);
    setRejectOpen(false);
    setMergeOpen(false);
    setEscalateOpen(false);
    setAssignOpen(false);
    setCompleteProofOpen(false);
    setRemarks('');
    setCategoryId('');
    setDepartmentId('');
    setReasonCode('');
    setOverrideAi(false);
    setDuplicateIds('');
  }, [id]);

  const goNext = useCallback(() => {
    void qc
      .fetchQuery({
        queryKey: ['moderator', 'queue', { status: 'pending_moderator', per_page: 20 }],
        queryFn: () => queueApi.list({ status: 'pending_moderator', per_page: 20 }),
      })
      .then((res) => {
        const data = res.data;
        const idx = data.findIndex((r) => r.id === id);
        const next = data[idx + 1] ?? data[0];
        if (next && next.id !== id) {
          void navigate(`/moderator/reports/${next.id}`);
        } else {
          void navigate('/moderator/queue');
        }
      })
      .catch(() => {
        void navigate('/moderator/queue');
      });
  }, [id, navigate, qc]);

  const review = useMutation({
    mutationFn: (p: ReviewPayload) =>
      actionsApi.review(id, { ...p, expected_workflow_version: data?.workflow_version }),
    onSuccess: (updated) => {
      qc.setQueryData(['moderator', 'reports', id], updated);
      void qc.invalidateQueries({ queryKey: ['moderator', 'queue'] });
      setApproveOpen(false);
      setCompleteProofOpen(false);
      setRemarks('');
      void navigate('/moderator/queue');
    },
  });
  const reject = useMutation({
    mutationFn: (p: { reason_code: string; remarks?: string }) =>
      actionsApi.reject(id, { ...p, expected_workflow_version: data?.workflow_version }),
    onSuccess: (updated) => {
      qc.setQueryData(['moderator', 'reports', id], updated);
      void qc.invalidateQueries({ queryKey: ['moderator', 'queue'] });
      setRejectOpen(false);
      void navigate('/moderator/queue');
    },
  });
  const merge = useMutation({
    mutationFn: (p: MergePayload) =>
      actionsApi.merge(id, { ...p, expected_workflow_version: data?.workflow_version }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['moderator', 'queue'] });
      setMergeOpen(false);
    },
  });
  const escalate = useMutation({
    mutationFn: (p: { reason_code: string; remarks?: string }) =>
      actionsApi.escalate(id, { ...p, expected_workflow_version: data?.workflow_version }),
    onSuccess: (updated) => {
      qc.setQueryData(['moderator', 'reports', id], updated);
      void qc.invalidateQueries({ queryKey: ['moderator', 'queue'] });
      setEscalateOpen(false);
    },
  });
  const assign = useMutation({
    mutationFn: (p: { department_id: string; officer_id?: string; reason: string }) =>
      actionsApi.reassign(id, { ...p, expected_workflow_version: data?.workflow_version }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['moderator', 'reports', id] });
      void qc.invalidateQueries({ queryKey: ['moderator', 'queue'] });
      setAssignOpen(false);
    },
  });

  const shortcuts = useMemo(
    () => ({
      a: () => setApproveOpen(true),
      r: () => setRejectOpen(true),
      m: () => setMergeOpen(true),
      e: () => setEscalateOpen(true),
      n: () => goNext(),
    }),
    [goNext],
  );
  useKeyboardShortcuts(shortcuts, !isLoading && Boolean(data));

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[#f3f2ed]"
        aria-live="polite"
      >
        <Spinner label="Loading report" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="w-full">
        <EmptyState
          title="Report not found"
          description="The report may have been merged or rejected, or you may not have access to it."
          action={
            <Link
              to="/moderator/queue"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#1d1d1b] px-5 text-sm text-white transition hover:bg-black"
            >
              <IconArrowLeft className="h-4 w-4" stroke={1.6} />
              Back to review reports
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mx-auto max-w-6xl space-y-6">
        <ModeratorReportHeader data={data} />

        <Card>
          <CardBody>
            <p className="whitespace-pre-line text-sm leading-6 text-[#1d1d1b]">
              {data.description}
            </p>
            {/* Submitted-at is already in the header, so it is not
                repeated here. Location carries a full geocoded address
                and gets its own wider column rather than forcing every
                field to the tallest one's height. */}
            <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-[#e4e2dc] pt-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-2.5">
                <IconCategory className="h-4 w-4 shrink-0 text-[#85847f]" stroke={1.6} />
                <div className="min-w-0">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                    Category
                  </dt>
                  <dd className="mt-0.5 truncate text-sm text-[#1d1d1b]">
                    {data.category?.name ?? '—'}
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <IconBuilding className="h-4 w-4 shrink-0 text-[#85847f]" stroke={1.6} />
                <div className="min-w-0">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                    Department
                  </dt>
                  <dd className="mt-0.5 truncate text-sm text-[#1d1d1b]">
                    {data.department?.name ?? 'Not routed yet'}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5 sm:col-span-2">
                <IconMapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#85847f]" stroke={1.6} />
                <div className="min-w-0">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                    Location
                  </dt>
                  <dd className="mt-0.5 text-sm leading-5 text-[#1d1d1b]">
                    {data.location ? (
                      <LocationText lat={data.location.lat} lng={data.location.lng} />
                    ) : (
                      '—'
                    )}
                    {data.ward && ` · ${data.ward}`}
                  </dd>
                </div>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconClock className="h-5 w-5 text-[#6f6e69]" stroke={1.6} />
              <CardTitle>Status timeline</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            <StepTimeline {...buildStaffTimeline(data.status_history)} />
          </CardBody>
        </Card>

        {/* AI Analysis runs several screens long; evidence and the
            decision controls are short. Stacking those two in a sticky
            left rail keeps the photo and the actions in view for the
            whole scroll instead of leaving the column empty.

            The rails are `contents` below lg so their cards become grid
            items directly and `order-*` can interleave them: single
            column reads evidence -> analysis -> actions -> audit, so the
            decision controls never precede the analysis they act on. */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <div className="contents lg:sticky lg:top-6 lg:block lg:space-y-5 lg:self-start">
            <div className="order-1">
              <EvidenceViewer media={data.media} />
            </div>

            <Card className="order-3">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <IconClipboardCheck className="h-5 w-5 text-[#6f6e69]" stroke={1.6} />
                  <CardTitle>Moderation actions</CardTitle>
                </div>
                <span className="hidden text-xs text-[#85847f] sm:inline">
                  Shortcuts:{' '}
                  <kbd className="rounded bg-[#efeee9] px-1.5 py-0.5 font-mono text-[10px] text-[#1d1d1b]">
                    A
                  </kbd>{' '}
                  <kbd className="rounded bg-[#efeee9] px-1.5 py-0.5 font-mono text-[10px] text-[#1d1d1b]">
                    R
                  </kbd>{' '}
                  <kbd className="rounded bg-[#efeee9] px-1.5 py-0.5 font-mono text-[10px] text-[#1d1d1b]">
                    M
                  </kbd>{' '}
                  <kbd className="rounded bg-[#efeee9] px-1.5 py-0.5 font-mono text-[10px] text-[#1d1d1b]">
                    E
                  </kbd>{' '}
                  <kbd className="rounded bg-[#efeee9] px-1.5 py-0.5 font-mono text-[10px] text-[#1d1d1b]">
                    N
                  </kbd>
                </span>
              </CardHeader>
              <CardBody>
                <ActionFooter
                  statusCode={data.status_code}
                  onApprove={() => setApproveOpen(true)}
                  onReject={() => setRejectOpen(true)}
                  onMerge={() => setMergeOpen(true)}
                  onEscalate={() => setEscalateOpen(true)}
                  onCompleteProof={() => setCompleteProofOpen(true)}
                  proofReview={data.proof_review ?? null}
                  onAssign={() => setAssignOpen(true)}
                  busy={
                    review.isPending || reject.isPending || merge.isPending || escalate.isPending
                  }
                />
              </CardBody>
            </Card>
          </div>

          <div className="contents lg:block lg:space-y-5">
            <div className="order-2">
              <AiAnalysisPanel
                ai={data.ai_result}
                statusCode={data.status_code}
                mockGpsScore={data.mock_gps_score}
              />
            </div>
            <Card className="order-4">
              <button
                type="button"
                onClick={() => setAuditExpanded((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left"
                aria-expanded={auditExpanded}
              >
                <div className="flex items-center gap-2">
                  <IconClock className="h-5 w-5 text-[#6f6e69]" stroke={1.6} />
                  <CardTitle>Audit history</CardTitle>
                  <span className="rounded-full bg-[#efeee9] px-2 py-0.5 text-xs text-[#6f6e69]">
                    {data.status_history.length}
                  </span>
                </div>
                <IconChevronDown
                  className={`h-5 w-5 shrink-0 text-[#85847f] transition-transform duration-200 ${auditExpanded ? 'rotate-180' : ''}`}
                  stroke={1.6}
                />
              </button>
              {auditExpanded ? (
                <CardBody className="border-t border-[#e4e2dc] pt-4">
                  {data.status_history.length === 0 ? (
                    <p className="text-sm text-[#85847f]">No status changes yet.</p>
                  ) : (
                    <ol className="relative ml-3 border-l-2 border-[#e4e2dc] pl-6">
                      {[...data.status_history].reverse().map((h, i) => (
                        <li
                          key={`${h.to_code}-${h.created_at}-${i}`}
                          className="relative pb-6 last:pb-0"
                        >
                          <span className="absolute -left-[31px] top-1 grid h-5 w-5 place-items-center rounded-full bg-[#f3f2ed] ring-2 ring-[#e4e2dc]">
                            <span className="h-2 w-2 rounded-full bg-[#85847f]" />
                          </span>
                          <p className="text-sm font-medium text-[#1d1d1b]">
                            {h.from_code
                              ? `${staffReportStatusLabel(h.from_code)} → ${staffReportStatusLabel(h.to_code)}`
                              : staffReportStatusLabel(h.to_code)}
                          </p>
                          <p className="mt-0.5 text-xs text-[#6f6e69]">
                            {h.actor_name ?? 'System'}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#85847f]">
                            {new Date(h.created_at).toLocaleString()}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardBody>
              ) : null}
            </Card>
          </div>
        </div>

        {/* Approve dialog */}
        <Dialog
          open={approveOpen}
          onClose={() => setApproveOpen(false)}
          title="Approve and forward"
          size="lg"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setApproveOpen(false)}
                disabled={review.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                loading={review.isPending}
                onClick={() =>
                  review.mutate({
                    decision: 'approve',
                    remarks: remarks.trim() || undefined,
                    category_id: categoryId || undefined,
                    department_id: departmentId || undefined,
                    override_ai: overrideAi,
                  })
                }
              >
                Approve
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-[#6f6e69]">
              Approving moves the report to the next review step. Tick the override box if you are
              correcting the AI recommendation.
            </p>
            <Textarea
              label="Remarks (optional)"
              name="remarks"
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Briefly note the rationale for the audit trail."
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Select
                label="Category override (optional)"
                name="category_id"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                placeholder={categoryPlaceholder}
                options={categoryOptions}
              />
              <Select
                label="Department override (optional)"
                name="department_id"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                placeholder={departmentPlaceholder}
                options={departmentOptions}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[#1d1d1b]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[#d8d6cf] text-[#1d1d1b] focus:ring-[#1d1d1b]"
                checked={overrideAi}
                onChange={(e) => setOverrideAi(e.target.checked)}
              />
              I am overriding the AI recommendation
            </label>
          </div>
        </Dialog>

        <Dialog
          open={completeProofOpen}
          onClose={() => setCompleteProofOpen(false)}
          title="Complete after proof review"
          size="md"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setCompleteProofOpen(false)}
                disabled={review.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                loading={review.isPending}
                onClick={() =>
                  review.mutate({
                    decision: 'complete_proof',
                    remarks: remarks.trim() || undefined,
                  })
                }
              >
                Mark completed
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-[#6f6e69]">
              This closes the report after you review the completion proof. The citizen will see
              that the proof was handled by a moderator.
            </p>
            {data.proof_review ? (
              <div className="rounded-lg border border-[#e4e2dc] bg-[#faf9f6] p-3 text-sm">
                <p className="font-medium text-[#1d1d1b]">{data.proof_review.summary}</p>
                <p className="mt-1 text-xs text-[#6f6e69]">
                  {data.proof_review.overall_confidence}% overall confidence
                  {data.proof_review.distance_meters !== null
                    ? ` · ${Math.round(data.proof_review.distance_meters)} m from report location`
                    : ' · GPS unavailable'}
                </p>
              </div>
            ) : null}
            <Textarea
              label="Notes (optional)"
              name="proof_remarks"
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Briefly note the proof-review decision."
            />
          </div>
        </Dialog>

        <Dialog
          open={rejectOpen}
          onClose={() => setRejectOpen(false)}
          title="Reject report"
          size="md"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setRejectOpen(false)}
                disabled={reject.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={reject.isPending}
                disabled={!reasonCode}
                onClick={() => {
                  void reject.mutate({
                    reason_code: reasonCode,
                    remarks: remarks.trim() || undefined,
                  });
                }}
              >
                Reject
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Select
              label="Reason"
              name="reason_code"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              options={[{ value: '', label: '— pick a reason —' }, ...REJECT_REASONS]}
            />
            <Textarea
              label="Notes (optional)"
              name="remarks"
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional — visible in the audit log."
            />
          </div>
        </Dialog>

        <Dialog
          open={mergeOpen}
          onClose={() => setMergeOpen(false)}
          title="Merge duplicates"
          size="lg"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setMergeOpen(false)}
                disabled={merge.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={merge.isPending}
                disabled={!duplicateIds.trim()}
                onClick={() =>
                  merge.mutate({
                    duplicate_report_ids: duplicateIds
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                    reason_code: reasonCode || undefined,
                    remarks: remarks.trim() || undefined,
                  })
                }
              >
                Merge
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-[#6f6e69]">
              This report (<span className="font-mono">{data.tracking_number}</span>) becomes the
              canonical report; the ids below are folded into it and marked as merged.
            </p>
            <Input
              label="Duplicate report ids (comma separated)"
              name="duplicate_ids"
              value={duplicateIds}
              onChange={(e) => setDuplicateIds(e.target.value)}
              placeholder="9b6c…, 7a3f…"
            />
            <Select
              label="Reason"
              name="reason_code"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              options={[
                { value: '', label: '— pick a reason —' },
                { value: 'same_incident', label: 'Same incident' },
                { value: 'same_location', label: 'Same location, different time' },
              ]}
            />
            <Textarea
              label="Notes (optional)"
              name="remarks"
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </Dialog>

        <Dialog
          open={escalateOpen}
          onClose={() => setEscalateOpen(false)}
          title="Escalate for senior review"
          size="md"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setEscalateOpen(false)}
                disabled={escalate.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={escalate.isPending}
                disabled={!reasonCode}
                onClick={() => {
                  void escalate.mutate({
                    reason_code: reasonCode,
                    remarks: remarks.trim() || undefined,
                  });
                }}
              >
                Escalate
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Select
              label="Reason"
              name="reason_code"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              options={[{ value: '', label: '— pick a reason —' }, ...ESCALATE_REASONS]}
            />
            <Textarea
              label="Notes (optional)"
              name="remarks"
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </Dialog>

        <AssignmentDialog
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
          loading={assign.isPending}
          defaultDepartmentId={data.department?.id ?? undefined}
          departments={departmentOptions}
          departmentsLoading={departmentsQuery.isLoading}
          onSubmit={(r) => {
            void assign.mutateAsync(r);
          }}
        />
      </div>
    </div>
  );
}
