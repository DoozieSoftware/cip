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
  IconCalendar,
  IconCategory,
  IconBuilding,
  IconPhoto,
  IconClock,
  IconClipboardCheck,
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
} from '../shared/ui';
import { actionsApi, queueApi } from '../api/moderator';
import type { MergePayload, ReportDetail, ReportStatusCode, ReviewPayload } from '../types';
import { EvidenceViewer } from '../components/EvidenceViewer';
import { useReverseGeocode } from '../../../shared/geo/useReverseGeocode';
import { AiAnalysisPanel } from '../components/AiAnalysisPanel';
import { AssignmentDialog } from '../components/AssignmentDialog';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

function LocationText({ lat, lng }: { lat: number; lng: number }): JSX.Element {
  const place = useReverseGeocode(lat, lng);
  return <>{place || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</>;
}

const REJECT_REASONS = [
  { value: 'invalid_evidence', label: 'Invalid evidence' },
  { value: 'duplicate', label: 'Duplicate of another report' },
  { value: 'fraudulent', label: 'Fraudulent' },
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
  onAssign,
  busy,
}: {
  statusCode: ReportStatusCode;
  onApprove: () => void;
  onReject: () => void;
  onMerge: () => void;
  onEscalate: () => void;
  onAssign: () => void;
  busy: boolean;
}) {
  const decisionsEnabled = MODERATION_OPEN_STATES.includes(statusCode);

  return (
    <div className="space-y-3" role="group" aria-label="Moderation actions">
      <div className="flex flex-wrap gap-3">
        <Button
          variant="success"
          size="lg"
          onClick={onApprove}
          disabled={busy || !decisionsEnabled}
          aria-keyshortcuts="A"
          leftIcon={<IconCheck className="h-4 w-4" stroke={1.8} />}
          className="flex-1 sm:flex-none"
        >
          Approve
        </Button>
        <Button
          variant="danger"
          size="lg"
          onClick={onReject}
          disabled={busy || !decisionsEnabled}
          aria-keyshortcuts="R"
          leftIcon={<IconX className="h-4 w-4" stroke={1.8} />}
          className="flex-1 sm:flex-none"
        >
          Reject
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
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

  const [remarks, setRemarks] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [overrideAi, setOverrideAi] = useState(false);
  const [duplicateIds, setDuplicateIds] = useState('');

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
    mutationFn: (p: ReviewPayload) => actionsApi.review(id, p),
    onSuccess: (updated) => {
      qc.setQueryData(['moderator', 'reports', id], updated);
      void qc.invalidateQueries({ queryKey: ['moderator', 'queue'] });
      setApproveOpen(false);
      setRemarks('');
      void navigate('/moderator/queue');
    },
  });
  const reject = useMutation({
    mutationFn: (p: { reason_code: string; remarks?: string }) => actionsApi.reject(id, p),
    onSuccess: (updated) => {
      qc.setQueryData(['moderator', 'reports', id], updated);
      void qc.invalidateQueries({ queryKey: ['moderator', 'queue'] });
      setRejectOpen(false);
      void navigate('/moderator/queue');
    },
  });
  const merge = useMutation({
    mutationFn: (p: MergePayload) => actionsApi.merge(id, p),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['moderator', 'queue'] });
      setMergeOpen(false);
    },
  });
  const escalate = useMutation({
    mutationFn: (p: { reason_code: string; remarks?: string }) => actionsApi.escalate(id, p),
    onSuccess: (updated) => {
      qc.setQueryData(['moderator', 'reports', id], updated);
      void qc.invalidateQueries({ queryKey: ['moderator', 'queue'] });
      setEscalateOpen(false);
    },
  });
  const assign = useMutation({
    mutationFn: (p: { department_id: string; officer_id?: string; reason: string }) =>
      actionsApi.reassign(id, p),
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
      <div className="min-h-screen bg-[#f3f2ed] p-6">
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
    <div className="min-h-screen bg-[#f3f2ed] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <Link
            to="/moderator/queue"
            className="inline-flex min-h-[44px] items-center gap-2 text-sm text-[#6f6e69] transition hover:text-[#1d1d1b]"
          >
            <IconArrowLeft className="h-4 w-4" stroke={1.6} />
            Back to review reports
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#85847f]">
                {data.tracking_number}
              </p>
              <h1 className="mt-2 text-2xl font-medium tracking-[-0.02em] text-[#1d1d1b]">
                {data.title}
              </h1>
              <p className="mt-2 text-sm text-[#6f6e69]">
                Submitted {new Date(data.submitted_at).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                  data.status_code === 'pending_moderator' || data.status_code === 'ai_processing'
                    ? 'bg-amber-50 text-amber-700'
                    : data.status_code === 'escalated'
                      ? 'bg-violet-50 text-violet-700'
                      : data.status_code === 'rejected' || data.status_code === 'merged'
                        ? 'bg-red-50 text-red-700'
                        : data.status_code === 'closed' ||
                            data.status_code === 'verified' ||
                            data.status_code === 'resolved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-sky-50 text-sky-700'
                }`}
              >
                {data.status_code.replace(/_/g, ' ')}
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

        <Card>
          <CardBody>
            <p className="whitespace-pre-line text-sm leading-6 text-[#1d1d1b]">
              {data.description}
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#efeee9]">
                  <IconCategory className="h-4 w-4 text-[#6f6e69]" stroke={1.6} />
                </span>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                    Category
                  </p>
                  <p className="mt-0.5 text-sm text-[#1d1d1b]">{data.category?.name ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#efeee9]">
                  <IconBuilding className="h-4 w-4 text-[#6f6e69]" stroke={1.6} />
                </span>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                    Department
                  </p>
                  <p className="mt-0.5 text-sm text-[#1d1d1b]">{data.department?.name ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#efeee9]">
                  <IconMapPin className="h-4 w-4 text-[#6f6e69]" stroke={1.6} />
                </span>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                    Location
                  </p>
                  <p className="mt-0.5 text-sm text-[#1d1d1b]">
                    {data.location ? (
                      <LocationText lat={data.location.lat} lng={data.location.lng} />
                    ) : (
                      '—'
                    )}
                    {data.ward && ` · ${data.ward}`}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#efeee9]">
                  <IconCalendar className="h-4 w-4 text-[#6f6e69]" stroke={1.6} />
                </span>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                    Submitted
                  </p>
                  <p className="mt-0.5 text-sm text-[#1d1d1b]">
                    {new Date(data.submitted_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <EvidenceViewer media={data.media} />
          <AiAnalysisPanel
            ai={data.ai_result}
            statusCode={data.status_code}
            mockGpsScore={data.mock_gps_score}
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconClipboardCheck className="h-5 w-5 text-[#6f6e69]" stroke={1.6} />
              <CardTitle>Moderation actions</CardTitle>
            </div>
            <span className="text-xs text-[#85847f]">
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
              onAssign={() => setAssignOpen(true)}
              busy={review.isPending || reject.isPending || merge.isPending || escalate.isPending}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconClock className="h-5 w-5 text-[#6f6e69]" stroke={1.6} />
              <CardTitle>Audit history</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            {data.audit_log.length === 0 ? (
              <p className="text-sm text-[#85847f]">No audit entries yet.</p>
            ) : (
              <ol className="relative ml-3 border-l-2 border-[#e4e2dc] pl-6">
                {data.audit_log.map((a) => (
                  <li key={a.id} className="relative pb-6 last:pb-0">
                    <span className="absolute -left-[31px] top-1 grid h-5 w-5 place-items-center rounded-full bg-[#f3f2ed] ring-2 ring-[#e4e2dc]">
                      <span className="h-2 w-2 rounded-full bg-[#85847f]" />
                    </span>
                    <p className="text-sm font-medium text-[#1d1d1b]">{a.action}</p>
                    <p className="mt-0.5 text-xs text-[#6f6e69]">{a.actor_name ?? 'system'}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#85847f]">
                      {new Date(a.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>

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
              Approving moves the report to the next state in the workflow. Tick the override box if
              you are correcting the AI recommendation.
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
          onSubmit={(r) => {
            void assign.mutateAsync(r);
          }}
        />
      </div>
    </div>
  );
}
