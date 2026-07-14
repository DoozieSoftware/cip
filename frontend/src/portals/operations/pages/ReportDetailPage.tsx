import { useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Spinner,
  EmptyState,
  Button,
  Textarea,
  Badge,
} from '../design';
import { departmentApi } from '../api/operations';
import type { DepartmentReportListItem, InternalNote, ReportStatusCode, WorkflowEvent } from '../types';
import { useKeyboardShortcuts } from '../../moderator/hooks/useKeyboardShortcuts';

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

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const reportId = params.id ?? '';
  const queryClient = useQueryClient();
  const noteRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: report, isLoading, error, refetch } = useQuery<DepartmentReportListItem>({
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
  const action = useMutation({
    mutationFn: (event: WorkflowEvent) => departmentApi.action(reportId, event),
    onSuccess: (response) => {
      queryClient.setQueryData<DepartmentReportListItem>(
        ['operations', 'report', reportId],
        (current) => ({
          ...response.data,
          internal_notes: current?.internal_notes ?? response.data.internal_notes,
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ['operations', 'reports'] });
    },
  });
  const actionPending = action.isPending;
  const activeAction = action.variables;
  const addNote = useMutation({
    mutationFn: () => departmentApi.addNote(reportId, noteBody.trim()),
    onSuccess: () => {
      setNoteBody('');
      void refetchNotes();
      void queryClient.invalidateQueries({ queryKey: ['operations', 'report', reportId] });
    },
  });

  const runAction = useCallback(
    (event: WorkflowEvent): void => {
      if (
        reportId === ''
        || actionPending
        || report?.current_status_code !== actionStatus[event]
      ) {
        return;
      }
      action.mutate(event);
    },
    [action, actionPending, report?.current_status_code, reportId],
  );

  const focusNote = useCallback((): void => {
    noteRef.current?.focus();
  }, []);

  const shortcuts = useMemo(
    () => ({
      a: () => runAction('accept'),
      s: () => runAction('start'),
      r: () => runAction('resolve'),
      c: () => runAction('close'),
      n: () => focusNote(),
    }),
    [focusNote, runAction],
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
            onClick={() => { void refetch(); }}
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

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{report.title}</h1>
          <p className="font-mono text-xs text-slate-500">{report.tracking_number}</p>
        </div>
        <Badge tone="info">{status}</Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          <ActionButton
            label="Accept"
            event="accept"
            onAction={runAction}
            disabled={actionPending || status !== 'assigned'}
            working={actionPending && activeAction === 'accept'}
            shortcut="A"
          />
          <ActionButton
            label="Start"
            event="start"
            onAction={runAction}
            disabled={actionPending || status !== 'accepted'}
            working={actionPending && activeAction === 'start'}
            shortcut="S"
          />
          <ActionButton
            label="Progress"
            event="progress"
            onAction={runAction}
            disabled={actionPending || status !== 'in_progress'}
            working={actionPending && activeAction === 'progress'}
          />
          <ActionButton
            label="Resolve"
            event="resolve"
            onAction={runAction}
            disabled={actionPending || status !== 'in_progress'}
            working={actionPending && activeAction === 'resolve'}
            shortcut="R"
          />
          <ActionButton
            label="Close"
            event="close"
            onAction={runAction}
            disabled={actionPending || status !== 'resolved'}
            working={actionPending && activeAction === 'close'}
            shortcut="C"
          />
          {action.isError && (
            <p role="alert" className="w-full text-sm text-red-700">
              {action.error instanceof Error ? action.error.message : 'The report action failed.'}
            </p>
          )}
          {isTerminal && <p className="text-xs text-slate-500">This report is in a terminal state.</p>}
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
              onClick={() => { addNote.mutate(); }}
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
                  {n.author_name ?? 'system'} · {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                </p>
              </li>
            ))}
            {(notesData?.data ?? []).length === 0 && (
              <li className="text-sm text-slate-500">No notes yet.</li>
            )}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
