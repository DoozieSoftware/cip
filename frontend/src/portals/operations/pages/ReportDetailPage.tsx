import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
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
import { StatusTimeline, statusLabel, statusTone } from '../components/StatusTimeline';

function ActionButton({
  label,
  event,
  onAction,
  disabled,
  working,
  shortcut,
}: {
  label: string;
  event: WorkflowEvent;
  onAction: (event: WorkflowEvent) => void;
  disabled: boolean;
  working: boolean;
  shortcut?: string;
}) {
  return (
    <Button
      variant="primary"
      onClick={() => onAction(event)}
      disabled={disabled}
      aria-label={`${label} report`}
      aria-keyshortcuts={shortcut}
    >
      {working ? 'Working...' : label}
    </Button>
  );
}

const actionStatus: Partial<Record<WorkflowEvent, ReportStatusCode>> = {
  accept: 'assigned',
  start: 'accepted',
  progress: 'in_progress',
  resolve: 'in_progress',
  close: 'resolved',
};

const ACTION_META: Record<
  WorkflowEvent,
  { label: string; requiresNote: boolean; shortcut?: string }
> = {
  accept: { label: 'Accept', requiresNote: false, shortcut: 'A' },
  start: { label: 'Start', requiresNote: false, shortcut: 'S' },
  progress: { label: 'Progress', requiresNote: true },
  resolve: { label: 'Resolve', requiresNote: true, shortcut: 'R' },
  close: { label: 'Close', requiresNote: true, shortcut: 'C' },
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

  return (
    <div className="space-y-6">
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
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap items-center gap-2">
          {(Object.keys(ACTION_META) as WorkflowEvent[]).map((event) => (
            <ActionButton
              key={event}
              label={ACTION_META[event].label}
              event={event}
              onAction={requestAction}
              disabled={actionPending || status !== actionStatus[event]}
              working={actionPending && activeAction === event}
              shortcut={ACTION_META[event].shortcut}
            />
          ))}
          {action.isError && (
            <p role="alert" className="w-full text-sm text-red-700">
              {action.error instanceof Error ? action.error.message : 'The report action failed.'}
            </p>
          )}
          {isTerminal && (
            <p className="text-xs text-slate-500">This report is in a terminal state.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Citizen evidence</CardTitle>
          {evidence.length > 0 && (
            <span className="text-xs text-slate-500">
              {evidence.length} {evidence.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </CardHeader>
        <CardBody>
          {evidence.length === 0 ? (
            <EmptyState
              title="No evidence"
              description="The citizen did not attach any evidence to this report."
            />
          ) : (
            <MediaGallery items={evidence} label="Citizen evidence" />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proof of completion (officer)</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {proof.length === 0 ? (
            <p className="text-sm text-slate-500">No proof photos uploaded yet.</p>
          ) : (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                Uploaded by department
              </p>
              <MediaGallery items={proof} label="Proof of completion" />
            </div>
          )}
          {!isTerminal && (
            <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
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
                className="self-start"
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
          <CardTitle>Status timeline</CardTitle>
        </CardHeader>
        <CardBody>
          <StatusTimeline entries={report.status_history ?? []} />
        </CardBody>
      </Card>

      <LocationCard location={report.location} />

      <Card>
        <CardHeader>
          <CardTitle>Report details</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {report.description && (
            <p className="whitespace-pre-line text-sm text-slate-800">{report.description}</p>
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
              <dt className="text-xs uppercase tracking-wide text-slate-500">Assigned to</dt>
              <dd>{report.assigned_to?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Submitted</dt>
              <dd>{report.submitted_at ? new Date(report.submitted_at).toLocaleString() : '—'}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

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
        title={`${pendingMeta?.label ?? 'Action'} report`}
        description={pendingAction ? ACTION_DESCRIPTION[pendingAction] : undefined}
        confirmLabel={pendingMeta?.label ?? 'Confirm'}
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
