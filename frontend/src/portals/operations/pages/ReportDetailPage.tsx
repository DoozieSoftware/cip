import { useCallback, useMemo, useRef, useState } from 'react';

import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconArrowLeft,
  IconCircleCheck,
  IconClock,
  IconPaperclip,
  IconSend,
  IconShield,
  IconUser,
  IconAlertTriangle,
  IconUpload,
  IconFileText,
  IconMessageCircle,
  IconLink,
  IconCircleDotted,
} from '@tabler/icons-react';
import { Badge, EmptyState, Spinner, Textarea } from '../../../shared/ui';
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
import { useDepartmentSelection } from '../context/DepartmentSelectionContext';

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
  const { selectedId, ready, memberships } = useDepartmentSelection();
  const selectedDepartment = memberships.find((membership) => membership.id === selectedId);
  const queryClient = useQueryClient();
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const proofInputRef = useRef<HTMLInputElement | null>(null);

  const {
    data: report,
    isLoading,
    error,
    refetch,
  } = useQuery<DepartmentReportDetail>({
    queryKey: ['operations', 'report', reportId, selectedId],
    queryFn: () => departmentApi.showReportInDepartment(reportId, selectedId ?? ''),
    enabled: Boolean(reportId) && ready && memberships.length > 0 && Boolean(selectedId),
  });

  const { data: notesData, refetch: refetchNotes } = useQuery<InternalNote[]>({
    queryKey: ['operations', 'report', reportId, 'notes', selectedId],
    queryFn: () => departmentApi.listNotes(reportId, selectedId ?? undefined),
    enabled: Boolean(reportId) && ready && memberships.length > 0 && Boolean(selectedId),
  });

  const [noteBody, setNoteBody] = useState('');
  const [pendingAction, setPendingAction] = useState<WorkflowEvent | null>(null);
  const [taskCompletionPending, setTaskCompletionPending] = useState(false);

  const action = useMutation({
    mutationFn: (input: { event: WorkflowEvent; note?: string }) =>
      departmentApi.action(reportId, input.event, input.note),
    onSuccess: (response) => {
      queryClient.setQueryData<DepartmentReportDetail>(
        ['operations', 'report', reportId, selectedId],
        (current) =>
          ({
            ...response,
            internal_notes: current?.internal_notes ?? response.internal_notes,
          }) as DepartmentReportDetail,
      );
      void queryClient.invalidateQueries({ queryKey: ['operations', 'reports'] });
      void queryClient.invalidateQueries({ queryKey: ['operations', 'report', reportId] });
    },
  });
  const actionPending = action.isPending;
  const activeAction = action.variables?.event;

  const completeTask = useMutation({
    mutationFn: (note?: string) => {
      const assignment = report?.assignment;
      if (!report || assignment?.kind !== 'secondary') {
        throw new Error('Only a secondary task can be completed here.');
      }
      return departmentApi.completeTask(report.id, assignment.id, note, selectedId ?? undefined);
    },
    onSuccess: () => {
      setTaskCompletionPending(false);
      void queryClient.invalidateQueries({ queryKey: ['operations', 'reports'] });
      void queryClient.invalidateQueries({ queryKey: ['operations', 'report', reportId] });
    },
  });

  const addNote = useMutation({
    mutationFn: () => departmentApi.addNote(reportId, noteBody.trim(), selectedId ?? undefined),
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

  const handleProofFiles = (e: React.ChangeEvent<HTMLInputElement>): void => {
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

  if (isLoading || !ready || (memberships.length > 0 && !selectedId)) {
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
            className="text-sm font-medium text-[var(--color-ink)] underline underline-offset-2"
          >
            Retry
          </button>
        }
      />
    );
  }

  const status = report.current_status_code ?? 'unknown';
  const assignment = report.assignment;
  const isSecondaryTask = assignment?.kind === 'secondary';
  const taskStatus = assignment?.status ?? null;
  const isTerminal =
    status === 'closed' ||
    status === 'rejected' ||
    status === 'merged' ||
    (isSecondaryTask && taskStatus !== 'open');
  const evidence = report.media.filter((m) => m.role === 'evidence');
  const proof = report.media.filter((m) => m.role === 'proof');
  const pendingMeta = pendingAction ? ACTION_META[pendingAction] : null;
  const availableActions = isSecondaryTask
    ? []
    : (ACTIONS_BY_STATUS[status as ReportStatusCode] ?? []);

  return (
    <div className="space-y-5">
      <Link
        to="/operations/reports"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-ink)]"
      >
        <IconArrowLeft size={16} stroke={1.6} />
        Back to reports
      </Link>

      <header className="rounded-xl bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={isSecondaryTask ? 'purple' : 'neutral'}>
                {isSecondaryTask ? 'Linked report' : 'Primary report'}
              </Badge>
              <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>
              {report.report_type && <Badge tone="neutral">{report.report_type.name}</Badge>}
              {report.priority && <Badge tone="neutral">{report.priority.name}</Badge>}
            </div>
            <h1 className="mt-2 text-lg font-semibold text-[var(--color-ink)]">{report.title}</h1>
            <p className="mt-0.5 font-mono text-xs text-[var(--color-text-tertiary)]">
              {report.tracking_number}
            </p>
          </div>
          <div className="shrink-0">
            {(isSecondaryTask
              ? assignment?.sla_minutes != null
              : report.department_sla_minutes != null) && (
              <SlaChip
                createdAt={isSecondaryTask ? assignment?.assigned_at : report.created_at}
                slaMinutes={
                  isSecondaryTask ? assignment?.sla_minutes : report.department_sla_minutes
                }
                status={isSecondaryTask ? taskStatus : status}
              />
            )}
          </div>
        </div>
      </header>

      {report.assignments.length > 1 && (
        <div className="rounded-xl bg-white p-4">
          <div className="flex items-center gap-2">
            <IconLink size={14} stroke={1.6} className="text-[var(--color-text-tertiary)]" />
            <h2 className="text-sm font-semibold text-[var(--color-ink)]">Linked departments</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            This report needs action from multiple departments.
          </p>
          <div className="mt-3 space-y-0 divide-y divide-[var(--color-canvas)]">
            {report.assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={
                      'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ' +
                      (a.is_primary
                        ? 'bg-[var(--color-ink)] text-white '
                        : 'bg-[var(--color-canvas)] text-[var(--color-text-secondary)] ')
                    }
                  >
                    {a.is_primary ? 'P' : 'S'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      {a.department?.name ?? 'Department'}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {a.is_primary ? 'Primary — owns closure' : 'Linked — assists resolution'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge
                    tone={
                      a.status === 'completed'
                        ? 'success'
                        : a.status === 'cancelled'
                          ? 'danger'
                          : 'info'
                    }
                  >
                    {statusLabel(a.status)}
                  </Badge>
                  {a.officer && (
                    <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                      {a.officer.name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <IconShield size={14} stroke={1.6} className="text-[var(--color-text-tertiary)]" />
              <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Current workflow
              </p>
            </div>
            <h2 className="mt-1 text-base font-semibold text-[var(--color-ink)]">
              {statusLabel(status)}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[var(--color-text-secondary)]">
              {isSecondaryTask
                ? 'This linked task has its own completion state. The primary department retains control of the report workflow.'
                : (STATUS_GUIDANCE[status] ?? 'No workflow action is available for this status.')}
            </p>
          </div>
          {availableActions.length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              {availableActions.map((event) => {
                const meta = ACTION_META[event];
                return (
                  <button
                    key={event}
                    type="button"
                    onClick={() => requestAction(event)}
                    disabled={actionPending}
                    aria-keyshortcuts={meta.shortcut}
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      event === 'accept' || event === 'start'
                        ? 'bg-[var(--color-ink)] text-white hover:bg-[var(--color-ink)]/90'
                        : event === 'resolve'
                          ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                          : event === 'close'
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)]/80'
                    }`}
                  >
                    {actionPending && activeAction === event ? (
                      <span
                        aria-hidden
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      />
                    ) : event === 'accept' ? (
                      <IconCircleCheck size={14} stroke={1.6} />
                    ) : event === 'start' ? (
                      <IconAlertTriangle size={14} stroke={1.6} />
                    ) : event === 'resolve' ? (
                      <IconCircleCheck size={14} stroke={1.6} />
                    ) : event === 'close' ? (
                      <IconShield size={14} stroke={1.6} />
                    ) : (
                      <IconMessageCircle size={14} stroke={1.6} />
                    )}
                    {meta.label}
                  </button>
                );
              })}
            </div>
          )}
          {action.isError && (
            <p role="alert" className="w-full text-sm text-red-600 sm:basis-full">
              {action.error instanceof Error ? action.error.message : 'The report action failed.'}
            </p>
          )}
        </div>
      </div>

      {isSecondaryTask && (
        <div className="rounded-xl bg-white p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <IconLink size={14} stroke={1.6} className="text-[var(--color-text-tertiary)]" />
                <h2 className="text-sm font-semibold text-[var(--color-ink)]">Linked report</h2>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                Complete this department task without resolving or closing the report.
              </p>
              <div className="mt-3 flex items-center gap-4 text-xs">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Department
                  </p>
                  <p className="mt-0.5 font-medium text-[var(--color-ink)]">
                    {selectedDepartment?.name ?? 'Selected department'}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Assigned
                  </p>
                  <p className="mt-0.5 font-medium text-[var(--color-ink)]">
                    {new Date(assignment.assigned_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={taskStatus === 'completed' ? 'success' : 'info'}>
                {statusLabel(taskStatus)}
              </Badge>
              {taskStatus === 'open' && (
                <button
                  type="button"
                  onClick={() => setTaskCompletionPending(true)}
                  disabled={completeTask.isPending}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:opacity-50"
                >
                  {completeTask.isPending ? (
                    <span
                      aria-hidden
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    />
                  ) : (
                    <IconCircleCheck size={14} stroke={1.6} />
                  )}
                  Mark task complete
                </button>
              )}
            </div>
          </div>
          {completeTask.isError && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {completeTask.error instanceof Error
                ? completeTask.error.message
                : 'The task could not be completed.'}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <div className="space-y-5">
          <div className="rounded-xl bg-white p-4">
            <div className="flex items-center gap-2">
              <IconPaperclip size={14} stroke={1.6} className="text-[var(--color-text-tertiary)]" />
              <h2 className="text-sm font-semibold text-[var(--color-ink)]">Evidence and proof</h2>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              Citizen report on the left; department completion proof on the right.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-[var(--color-canvas)] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Before
                  </p>
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {evidence.length} {evidence.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                {evidence.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-text-tertiary)]/30 py-8 text-center">
                    <IconFileText
                      size={20}
                      stroke={1.6}
                      className="text-[var(--color-text-tertiary)]"
                    />
                    <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">No evidence</p>
                  </div>
                ) : (
                  <MediaGallery items={evidence} label="Citizen evidence" />
                )}
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-700">
                    After
                  </p>
                  <span className="text-xs text-emerald-700">
                    {proof.length === 0 ? 'Awaiting proof' : `${proof.length} uploaded`}
                  </span>
                </div>
                {proof.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-emerald-300 bg-white/70 py-8 text-center">
                    <IconUpload size={20} stroke={1.6} className="text-emerald-600" />
                    <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                      Upload proof photos after the field crew completes the work.
                    </p>
                  </div>
                ) : (
                  <MediaGallery items={proof} label="Proof of completion" />
                )}
              </div>
            </div>
            {!isTerminal && (
              <div className="mt-4 flex flex-col gap-2 border-t border-[var(--color-canvas)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[var(--color-text-tertiary)]">
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
                <button
                  type="button"
                  onClick={() => proofInputRef.current?.click()}
                  disabled={uploadProof.isPending}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--color-canvas)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]/80 disabled:opacity-50"
                >
                  <IconUpload size={14} stroke={1.6} />
                  {uploadProof.isPending ? 'Uploading...' : 'Upload proof photos'}
                </button>
                {uploadProof.isError && (
                  <p role="alert" className="text-sm text-red-600">
                    {uploadProof.error instanceof Error
                      ? uploadProof.error.message
                      : 'The proof photos could not be uploaded.'}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white p-4">
            <div className="flex items-center gap-2">
              <IconFileText size={14} stroke={1.6} className="text-[var(--color-text-tertiary)]" />
              <h2 className="text-sm font-semibold text-[var(--color-ink)]">Report details</h2>
            </div>
            <div className="mt-3 space-y-3">
              {report.description && (
                <p className="whitespace-pre-line text-sm leading-5 text-[var(--color-text-secondary)]">
                  {report.description}
                </p>
              )}
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Type
                  </dt>
                  <dd className="mt-0.5 text-[var(--color-ink)]">
                    {report.report_type?.name ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Priority
                  </dt>
                  <dd className="mt-0.5 text-[var(--color-ink)]">{report.priority?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Submitted
                  </dt>
                  <dd className="mt-0.5 text-[var(--color-ink)]">
                    {report.submitted_at ? new Date(report.submitted_at).toLocaleString() : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Reference
                  </dt>
                  <dd className="mt-0.5 font-mono text-[var(--color-ink)]">
                    {report.tracking_number}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="rounded-xl bg-white p-4">
            <div className="flex items-center gap-2">
              <IconCircleDotted
                size={14}
                stroke={1.6}
                className="text-[var(--color-text-tertiary)]"
              />
              <h2 className="text-sm font-semibold text-[var(--color-ink)]">Status timeline</h2>
            </div>
            <div className="mt-3">
              <StatusTimeline entries={report.status_history ?? []} />
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <LocationCard location={report.location} />
          <div className="rounded-xl bg-white p-4">
            <div className="flex items-center gap-2">
              <IconUser size={14} stroke={1.6} className="text-[var(--color-text-tertiary)]" />
              <h2 className="text-sm font-semibold text-[var(--color-ink)]">Accountability</h2>
            </div>
            <dl className="mt-3 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Department
                </dt>
                <dd className="font-medium text-[var(--color-ink)]">
                  {report.department?.name ?? '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Assigned officer
                </dt>
                <dd className="font-medium text-[var(--color-ink)]">
                  {report.assigned_to?.name ?? 'Unassigned'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  SLA
                </dt>
                <dd>
                  <SlaChip
                    createdAt={isSecondaryTask ? assignment?.assigned_at : report.created_at}
                    slaMinutes={
                      isSecondaryTask ? assignment?.sla_minutes : report.department_sla_minutes
                    }
                    status={isSecondaryTask ? taskStatus : status}
                  />
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      <div className="rounded-xl bg-white p-4">
        <div className="flex items-center gap-2">
          <IconMessageCircle size={14} stroke={1.6} className="text-[var(--color-text-tertiary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">Internal notes</h2>
        </div>
        <div className="mt-3 space-y-3">
          <div>
            <Textarea
              ref={noteRef}
              id="note-body"
              value={noteBody}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNoteBody(e.target.value)}
              placeholder="Site visit notes, contact log, etc."
              rows={3}
              aria-keyshortcuts="N"
              className="rounded-lg border-0 bg-[var(--color-canvas)] text-sm text-[var(--color-ink)] placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-ink)]/10"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  addNote.mutate();
                }}
                disabled={addNote.isPending || noteBody.trim() === ''}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-ink)]/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {addNote.isPending ? (
                  <span
                    aria-hidden
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                ) : (
                  <IconSend size={14} stroke={1.6} />
                )}
                Save note
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {(notesData ?? []).map((n) => (
              <div key={n.id} className="rounded-lg bg-[var(--color-canvas)] p-3">
                <p className="text-sm leading-5 text-[var(--color-ink)]">{n.body}</p>
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                  <IconUser size={10} stroke={1.6} />
                  <span>{n.author_name ?? 'system'}</span>
                  <span aria-hidden>·</span>
                  <IconClock size={10} stroke={1.6} />
                  <span>{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</span>
                </p>
              </div>
            ))}
            {(notesData ?? []).length === 0 && (
              <p className="py-4 text-center text-xs text-[var(--color-text-tertiary)]">
                No notes yet.
              </p>
            )}
          </div>
        </div>
      </div>

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
      <ConfirmActionDialog
        open={taskCompletionPending}
        title="Mark task complete"
        description="Confirm that your department's linked work is complete. This will not change the primary report status."
        confirmLabel="Complete task"
        confirmVariant="success"
        requiresNote
        busy={completeTask.isPending}
        onConfirm={(note) => completeTask.mutate(note)}
        onClose={() => setTaskCompletionPending(false)}
      />
    </div>
  );
}
