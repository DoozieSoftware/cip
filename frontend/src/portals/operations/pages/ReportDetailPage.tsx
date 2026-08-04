import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
  Textarea,
} from '../design';
import { departmentApi } from '../api/operations';
import type {
  DepartmentReportDetail,
  InternalNote,
  ReportStatusCode,
  WorkflowEvent,
} from '../types';
import { useKeyboardShortcuts } from '../../moderator/hooks/useKeyboardShortcuts';
import { ConfirmActionDialog } from '../components/ConfirmActionDialog';
import { LocationCard } from '../components/LocationCard';
import { MediaGallery } from '../components/MediaGallery';
import { SlaChip } from '../components/SlaChip';
import { StatusTimeline } from '../components/StatusTimeline';
import { statusLabel, statusTone } from '../components/statusMeta';

const actionStatus: Partial<Record<WorkflowEvent, ReportStatusCode>> = {
  accept: 'assigned',
  start: 'accepted',
  progress: 'in_progress',
  resolve: 'in_progress',
  close: 'resolved',
};

const ACTION_META: Record<
  WorkflowEvent,
  {
    label: string;
    confirmLabel: string;
    requiresNote: boolean;
    shortcut?: string;
    variant: 'primary' | 'secondary' | 'success' | 'danger';
  }
> = {
  accept: {
    label: 'Accept assignment',
    confirmLabel: 'Accept',
    requiresNote: false,
    shortcut: 'A',
    variant: 'primary',
  },
  start: {
    label: 'Start field work',
    confirmLabel: 'Start work',
    requiresNote: false,
    shortcut: 'S',
    variant: 'primary',
  },
  progress: {
    label: 'Add progress update',
    confirmLabel: 'Save update',
    requiresNote: true,
    variant: 'secondary',
  },
  resolve: {
    label: 'Mark as resolved',
    confirmLabel: 'Resolve report',
    requiresNote: true,
    shortcut: 'R',
    variant: 'success',
  },
  close: {
    label: 'Close report',
    confirmLabel: 'Close report',
    requiresNote: true,
    shortcut: 'C',
    variant: 'danger',
  },
};

const ACTIONS_BY_STATUS: Partial<Record<ReportStatusCode, WorkflowEvent[]>> = {
  assigned: ['accept'],
  accepted: ['start'],
  in_progress: ['progress', 'resolve'],
  resolved: ['close'],
};

const STATUS_GUIDANCE: Record<string, string> = {
  assigned: 'Review the evidence and location, then accept responsibility for this report.',
  accepted: 'The assignment is yours. Start field work when the team is ready to proceed.',
  in_progress: 'Record a field update or mark the work as resolved when it is complete.',
  resolved: 'Review the completion proof and close the report when the outcome is confirmed.',
  verified: 'Completion has been verified. No further officer action is required.',
  closed: 'This report is complete and closed.',
  escalated: 'This report has been escalated for supervisor attention.',
  merged: 'This report was merged into another case.',
};

const ACTION_DESCRIPTION: Record<WorkflowEvent, string> = {
  accept: 'Accept this report and take responsibility for resolving it.',
  start: 'Start field work on this report.',
  progress:
    'Record a progress update. A note is required so the citizen and supervisor know what is happening.',
  resolve: 'Resolve this report. A note is required describing what was done.',
  close: 'Close this report. A note is required documenting the outcome.',
};

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const reportId = params.id ?? '';
  const queryClient = useQueryClient();
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const proofInputRef = useRef<HTMLInputElement | null>(null);

  const {
    data: report,
    isLoading,
    error,
    refetch,
  } = useQuery<DepartmentReportDetail>({
    queryKey: ['operations', 'report', reportId],
    queryFn: async () => (await departmentApi.showReport(reportId)).data,
    enabled: Boolean(reportId),
  });

  const { data: notesData, refetch: refetchNotes } = useQuery<{ data: InternalNote[] }>({
    queryKey: ['operations', 'report', reportId, 'notes'],
    queryFn: () => departmentApi.listNotes(reportId),
    enabled: Boolean(reportId),
  });

  const [noteBody, setNoteBody] = useState('');
  const [pendingAction, setPendingAction] = useState<WorkflowEvent | null>(null);

  const action = useMutation({
    mutationFn: (input: { event: WorkflowEvent; note?: string }) =>
      departmentApi.action(reportId, input.event, input.note),
    onSuccess: (response) => {
      queryClient.setQueryData<DepartmentReportDetail>(
        ['operations', 'report', reportId],
        (current) =>
          ({
            ...response.data,
            internal_notes: current?.internal_notes ?? response.data.internal_notes,
          }) as DepartmentReportDetail,
      );
      void queryClient.invalidateQueries({ queryKey: ['operations', 'reports'] });
      void queryClient.invalidateQueries({ queryKey: ['operations', 'report', reportId] });
    },
  });
  const actionPending = action.isPending;
  const activeAction = action.variables?.event;

  const addNote = useMutation({
    mutationFn: () => departmentApi.addNote(reportId, noteBody.trim()),
    onSuccess: () => {
      setNoteBody('');
      void refetchNotes();
      void queryClient.invalidateQueries({ queryKey: ['operations', 'report', reportId] });
    },
  });

  const uploadProof = useMutation({
    mutationFn: (files: File[]) => departmentApi.uploadProof(reportId, files),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['operations', 'report', reportId] });
    },
  });

  const requestAction = useCallback(
    (event: WorkflowEvent): void => {
      if (reportId === '' || actionPending || report?.current_status_code !== actionStatus[event]) {
        return;
      }
      setPendingAction(event);
    },
    [actionPending, report?.current_status_code, reportId],
  );

  const confirmAction = useCallback(
    (note?: string): void => {
      if (pendingAction === null) return;
      action.mutate({ event: pendingAction, note });
      setPendingAction(null);
    },
    [action, pendingAction],
  );

  const handleProofFiles = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length > 0) uploadProof.mutate(files);
  };

  const focusNote = useCallback((): void => {
    noteRef.current?.focus();
  }, []);

  const shortcuts = useMemo(
    () => ({
      a: () => requestAction('accept'),
      s: () => requestAction('start'),
      r: () => requestAction('resolve'),
      c: () => requestAction('close'),
      n: () => focusNote(),
    }),
    [focusNote, requestAction],
  );
  useKeyboardShortcuts(shortcuts, !isLoading && Boolean(report));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading report" />
      </div>
    );
  }
  if (error || !report) {
    return (
      <EmptyState
        title="Report not found"
        description="The report could not be loaded."
        action={
          <button
            type="button"
            onClick={() => {
              void refetch();
            }}
            className="text-sm font-medium text-emerald-600 hover:underline"
          >
            Retry
          </button>
        }
      />
    );
  }

  const status = report.current_status_code ?? 'unknown';
  const isTerminal = status === 'closed' || status === 'rejected' || status === 'merged';
  const evidence = report.media.filter((m) => m.role === 'evidence');
  const proof = report.media.filter((m) => m.role === 'proof');
  const pendingMeta = pendingAction ? ACTION_META[pendingAction] : null;
  const availableActions = ACTIONS_BY_STATUS[status as ReportStatusCode] ?? [];

  return (
    <div className="space-y-6">
      <Link
        to="/operations/reports"
        className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
      >
        ← Back to reports
      </Link>
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{report.title}</h1>
            <p className="font-mono text-xs text-slate-500">{report.tracking_number}</p>
          </div>
          <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {report.report_type && <Badge tone="neutral">{report.report_type.name}</Badge>}
          {report.priority && <Badge tone="neutral">{report.priority.name} priority</Badge>}
          {report.department_sla_minutes != null && (
            <SlaChip
              createdAt={report.created_at}
              slaMinutes={report.department_sla_minutes}
              status={status}
            />
          )}
        </div>
      </header>

      <Card>
        <CardBody className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Current workflow
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{statusLabel(status)}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {STATUS_GUIDANCE[status] ?? 'No workflow action is available for this status.'}
            </p>
          </div>
          {availableActions.length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              {availableActions.map((event) => {
                const meta = ACTION_META[event];
                return (
                  <Button
                    key={event}
                    variant={meta.variant}
                    size="lg"
                    onClick={() => requestAction(event)}
                    disabled={actionPending}
                    loading={actionPending && activeAction === event}
                    aria-keyshortcuts={meta.shortcut}
                  >
                    {meta.label}
                  </Button>
                );
              })}
            </div>
          )}
          {action.isError && (
            <p role="alert" className="w-full text-sm text-red-700 sm:basis-full">
              {action.error instanceof Error ? action.error.message : 'The report action failed.'}
            </p>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>Evidence and proof</CardTitle>
                <p className="mt-1 text-xs text-slate-500">
                  Citizen report on the left; department completion proof on the right.
                </p>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Before
                    </p>
                    <span className="text-xs text-slate-500">
                      {evidence.length} {evidence.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  {evidence.length === 0 ? (
                    <EmptyState
                      title="No evidence"
                      description="The citizen did not attach any evidence to this report."
                    />
                  ) : (
                    <MediaGallery items={evidence} label="Citizen evidence" />
                  )}
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      After
                    </p>
                    <span className="text-xs text-emerald-700">
                      {proof.length === 0 ? 'Awaiting proof' : `${proof.length} uploaded`}
                    </span>
                  </div>
                  {proof.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-emerald-300 bg-white/70 px-4 py-8 text-center text-sm text-slate-600">
                      Upload proof photos after the field crew completes the work.
                    </p>
                  ) : (
                    <MediaGallery items={proof} label="Proof of completion" />
                  )}
                </div>
              </div>
              {!isTerminal && (
                <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">
                    Proof photos stay department-private until the report is closed.
                  </p>
                  <input
                    ref={proofInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    aria-label="Proof photo input"
                    onChange={handleProofFiles}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => proofInputRef.current?.click()}
                    disabled={uploadProof.isPending}
                  >
                    {uploadProof.isPending ? 'Uploading…' : 'Upload proof photos'}
                  </Button>
                  {uploadProof.isError && (
                    <p role="alert" className="text-sm text-red-700">
                      {uploadProof.error instanceof Error
                        ? uploadProof.error.message
                        : 'The proof photos could not be uploaded.'}
                    </p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Report details</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {report.description && (
                <p className="whitespace-pre-line text-sm leading-6 text-slate-800">
                  {report.description}
                </p>
              )}
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Type</dt>
                  <dd>{report.report_type?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Priority</dt>
                  <dd>{report.priority?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Submitted</dt>
                  <dd>
                    {report.submitted_at ? new Date(report.submitted_at).toLocaleString() : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Reference</dt>
                  <dd className="font-mono text-xs">{report.tracking_number}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status timeline</CardTitle>
            </CardHeader>
            <CardBody>
              <StatusTimeline entries={report.status_history ?? []} />
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-5">
          <LocationCard location={report.location} />
          <Card>
            <CardHeader>
              <CardTitle>Accountability</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Department</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {report.department?.name ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">
                    Assigned officer
                  </dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {report.assigned_to?.name ?? 'Unassigned'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">SLA</dt>
                  <dd className="mt-1">
                    <SlaChip
                      createdAt={report.created_at}
                      slaMinutes={report.department_sla_minutes}
                      status={status}
                    />
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        </aside>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Internal notes</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="note-body">
              Add a note (department-private)
            </label>
            <Textarea
              ref={noteRef}
              id="note-body"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Site visit notes, contact log, etc."
              rows={4}
              aria-keyshortcuts="N"
            />
            <Button
              variant="primary"
              onClick={() => {
                addNote.mutate();
              }}
              disabled={addNote.isPending || noteBody.trim() === ''}
            >
              {addNote.isPending ? 'Saving…' : 'Save note'}
            </Button>
          </div>

          <ul className="space-y-2">
            {(notesData?.data ?? []).map((n) => (
              <li key={n.id} className="rounded border border-slate-200 p-3">
                <p className="text-sm text-slate-800">{n.body}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {n.author_name ?? 'system'} ·{' '}
                  {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                </p>
              </li>
            ))}
            {(notesData?.data ?? []).length === 0 && (
              <li className="text-sm text-slate-500">No notes yet.</li>
            )}
          </ul>
        </CardBody>
      </Card>

      <ConfirmActionDialog
        open={pendingAction !== null}
        title={pendingMeta?.label ?? 'Confirm action'}
        description={pendingAction ? ACTION_DESCRIPTION[pendingAction] : undefined}
        confirmLabel={pendingMeta?.confirmLabel ?? 'Confirm'}
        confirmVariant={
          pendingAction === 'close' ? 'danger' : pendingAction === 'resolve' ? 'success' : 'primary'
        }
        requiresNote={pendingMeta?.requiresNote ?? false}
        busy={actionPending}
        onConfirm={confirmAction}
        onClose={() => setPendingAction(null)}
      />
    </div>
  );
}
