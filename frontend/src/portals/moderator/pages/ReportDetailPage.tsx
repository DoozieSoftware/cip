import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useState, useCallback, useMemo } from 'react';
import {
  Badge,
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
} from '../design';
import { actionsApi, queueApi } from '../api/moderator';
import type { MergePayload, ReportDetail, ReviewPayload } from '../types';
import { EvidenceViewer } from '../components/EvidenceViewer';
import { AiAnalysisPanel } from '../components/AiAnalysisPanel';
import { AssignmentDialog } from '../components/AssignmentDialog';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

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

function ActionFooter({
  onApprove,
  onReject,
  onMerge,
  onEscalate,
  onAssign,
  busy,
}: {
  onApprove: () => void;
  onReject: () => void;
  onMerge: () => void;
  onEscalate: () => void;
  onAssign: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2" role="group" aria-label="Moderation actions">
      <Button variant="success" onClick={onApprove} disabled={busy} aria-keyshortcuts="A">
        Approve
      </Button>
      <Button variant="danger" onClick={onReject} disabled={busy} aria-keyshortcuts="R">
        Reject
      </Button>
      <Button variant="secondary" onClick={onMerge} disabled={busy} aria-keyshortcuts="M">
        Merge…
      </Button>
      <Button variant="ghost" onClick={onEscalate} disabled={busy} aria-keyshortcuts="E">
        Escalate
      </Button>
      <Button variant="secondary" onClick={onAssign} disabled={busy} aria-keyshortcuts="T">
        Reassign
      </Button>
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
    refetchInterval: 10_000,
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
  const [canonicalId, setCanonicalId] = useState('');
  const [duplicateIds, setDuplicateIds] = useState('');

  const review = useMutation({
    mutationFn: (p: ReviewPayload) => actionsApi.review(id, p),
    onSuccess: (updated) => {
      qc.setQueryData(['moderator', 'reports', id], updated);
      void qc.invalidateQueries({ queryKey: ['moderator', 'queue'] });
      setApproveOpen(false);
      setRemarks('');
    },
  });
  const reject = useMutation({
    mutationFn: (p: { reason_code: string; remarks?: string }) => actionsApi.reject(id, p),
    onSuccess: (updated) => {
      qc.setQueryData(['moderator', 'reports', id], updated);
      void qc.invalidateQueries({ queryKey: ['moderator', 'queue'] });
      setRejectOpen(false);
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
  // Reassign goes through the M7 ReassignService on the backend; the dialog
  // currently POSTs a ReviewReportDto with `decision=approve` so the M6
  // transition fires and the M7 listener reassigns. The dedicated
  // `/api/v1/moderator/reports/{id}/reassign` endpoint will be added in M11.
  const assign = useMutation({
    mutationFn: () => Promise.resolve(),
    onSuccess: () => setAssignOpen(false),
  });

  const goNext = useCallback(() => {
    // T-M10-021: N jumps to the next report in the queue.
    void qc.fetchQuery({ queryKey: ['moderator', 'queue', { page: 1 }] }).then((res) => {
      const data = (res as { data: { id: string }[] })?.data ?? [];
      const idx = data.findIndex((r) => r.id === id);
      const next = data[idx + 1] ?? data[0];
      if (next) {
        void navigate(`/moderator/reports/${next.id}`);
      }
    });
  }, [id, navigate, qc]);

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
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading report" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <EmptyState
        title="Report not found"
        description="The report may have been merged or rejected, or you may not have access to it."
        action={
          <Link to="/moderator/queue" className="text-sm font-medium text-brand-700 hover:underline">
            ← Back to queue
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/moderator/queue" className="text-xs text-brand-700 hover:underline">
            ← Queue
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{data.title}</h1>
          <p className="text-sm text-slate-500">
            <span className="font-mono">{data.tracking_number}</span> · submitted{' '}
            {new Date(data.submitted_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="info">{data.status_code.replace(/_/g, ' ')}</Badge>
          {data.evidence_count > 0 && <Badge tone="neutral">{data.evidence_count} evidence</Badge>}
        </div>
      </header>

      <Card>
        <CardBody>
          <p className="whitespace-pre-line text-sm text-slate-800">{data.description}</p>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Category</dt>
              <dd>{data.category?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Department</dt>
              <dd>{data.department?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Location</dt>
              <dd>
                {data.location ? `${data.location.lat.toFixed(4)}, ${data.location.lng.toFixed(4)}` : '—'}
                {data.ward && ` · ${data.ward}`}
                {data.district && ` · ${data.district}`}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <EvidenceViewer media={data.media} />
        <AiAnalysisPanel ai={data.ai_result} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Moderation actions</CardTitle>
          <span className="text-xs text-slate-500">
            Shortcuts: <kbd className="rounded bg-slate-100 px-1">A</kbd> <kbd className="rounded bg-slate-100 px-1">R</kbd>{' '}
            <kbd className="rounded bg-slate-100 px-1">M</kbd> <kbd className="rounded bg-slate-100 px-1">E</kbd>{' '}
            <kbd className="rounded bg-slate-100 px-1">N</kbd>
          </span>
        </CardHeader>
        <CardBody>
          <ActionFooter
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
          <CardTitle>Audit history</CardTitle>
        </CardHeader>
        <CardBody>
          {data.audit_log.length === 0 ? (
            <p className="text-sm text-slate-500">No audit entries yet.</p>
          ) : (
            <ol className="space-y-2">
              {data.audit_log.map((a) => (
                <li key={a.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <p className="font-medium text-slate-800">
                    {a.action} <span className="font-normal text-slate-500">— {a.actor_name ?? 'system'}</span>
                  </p>
                  <p className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>

      {/* Approve dialog — also the manual override path */}
      <Dialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Approve and forward"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproveOpen(false)} disabled={review.isPending}>
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
          <p className="text-sm text-slate-600">
            Approving moves the report to the next state in the workflow. Tick the override box if you are correcting
            the AI recommendation.
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
            <Input
              label="Category override (UUID, optional)"
              name="category_id"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder="Leave blank to keep the AI suggestion"
            />
            <Input
              label="Department override (UUID, optional)"
              name="department_id"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              placeholder="Leave blank to keep the AI suggestion"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
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
            <Button variant="secondary" onClick={() => setRejectOpen(false)} disabled={reject.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={reject.isPending}
              disabled={!reasonCode}
              onClick={() => { void reject.mutate({ reason_code: reasonCode, remarks: remarks.trim() || undefined }); }}
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
            <Button variant="secondary" onClick={() => setMergeOpen(false)} disabled={merge.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={merge.isPending}
              disabled={!canonicalId || !duplicateIds.trim()}
              onClick={() =>
                merge.mutate({
                  canonical_id: canonicalId,
                  duplicate_ids: duplicateIds.split(',').map((s) => s.trim()).filter(Boolean),
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
          <Input
            label="Canonical report id (UUID)"
            name="canonical_id"
            value={canonicalId}
            onChange={(e) => setCanonicalId(e.target.value)}
            placeholder="e.g. 9b6c…"
          />
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
        title="Escalate to senior queue"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEscalateOpen(false)} disabled={escalate.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={escalate.isPending}
              disabled={!reasonCode}
              onClick={() => { void escalate.mutate({ reason_code: reasonCode, remarks: remarks.trim() || undefined }); }}
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
        onSubmit={(r) => { void assign.mutateAsync(r as never); }}
      />
    </div>
  );
}
