import { useState } from 'react';
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
import type { DepartmentReportListItem, InternalNote, WorkflowEvent } from '../types';

function ActionButton({
  label,
  event,
  reportId,
  queryClient,
}: {
  label: string;
  event: WorkflowEvent;
  reportId: string;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const mutation = useMutation({
    mutationFn: () => departmentApi.action(reportId, event),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['operations', 'reports'] });
    },
  });
  return (
    <Button
      variant="primary"
      onClick={() => { mutation.mutate(); }}
      disabled={mutation.isPending}
      aria-label={`${label} report`}
    >
      {mutation.isPending ? 'Working…' : label}
    </Button>
  );
}

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const reportId = params.id ?? '';
  const queryClient = useQueryClient();

  const { data: report, isLoading, error, refetch } = useQuery<DepartmentReportListItem>({
    queryKey: ['operations', 'report', reportId],
    queryFn: async () => (await departmentApi.listReports({ page: 1, per_page: 1 })).data.find((r) => r.id === reportId) as DepartmentReportListItem,
    enabled: Boolean(reportId),
  });

  const { data: notesData, refetch: refetchNotes } = useQuery<{ data: InternalNote[] }>({
    queryKey: ['operations', 'report', reportId, 'notes'],
    queryFn: () => departmentApi.listNotes(reportId),
    enabled: Boolean(reportId),
  });

  const [noteBody, setNoteBody] = useState('');
  const addNote = useMutation({
    mutationFn: () => departmentApi.addNote(reportId, noteBody.trim()),
    onSuccess: () => {
      setNoteBody('');
      void refetchNotes();
      void queryClient.invalidateQueries({ queryKey: ['operations', 'report', reportId] });
    },
  });

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
          <ActionButton label="Accept" event="accept" reportId={report.id} queryClient={queryClient} />
          <ActionButton label="Start" event="start" reportId={report.id} queryClient={queryClient} />
          <ActionButton label="Progress" event="progress" reportId={report.id} queryClient={queryClient} />
          <ActionButton label="Resolve" event="resolve" reportId={report.id} queryClient={queryClient} />
          <ActionButton label="Close" event="close" reportId={report.id} queryClient={queryClient} />
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
              id="note-body"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Site visit notes, contact log, etc."
              rows={4}
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
