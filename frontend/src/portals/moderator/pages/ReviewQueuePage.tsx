import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  Input,
  Select,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../design';
import { queueApi, type QueueFilters } from '../api/moderator';
import type { ReportListItem, ReportStatusCode } from '../types';
import { useState } from 'react';

function statusTone(s: ReportStatusCode) {
  switch (s) {
    case 'pending_moderator':
    case 'ai_processing':
      return 'warning' as const;
    case 'merged':
    case 'rejected':
      return 'danger' as const;
    case 'escalated':
      return 'purple' as const;
    case 'closed':
    case 'verified':
    case 'resolved':
      return 'success' as const;
    default:
      return 'info' as const;
  }
}

export default function ReviewQueuePage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<QueueFilters>({
    status: params.get('status') ?? 'pending_moderator',
    category: params.get('category') ?? '',
    ward: params.get('ward') ?? '',
    confidence_min: params.get('confidence_min') ? Number(params.get('confidence_min')) : undefined,
    per_page: 20,
  });
  // Stack of cursors visited so "Previous" can pop back — cursor
  // pagination (unlike offset pagination) only exposes next/prev from
  // the current position, not an arbitrary page number.
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const query = useQuery({
    queryKey: ['moderator', 'queue', filters],
    queryFn: () => queueApi.list(filters),
    refetchInterval: 15_000,
  });

  function update<K extends keyof QueueFilters>(key: K, value: QueueFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, cursor: undefined }));
    setCursorStack([]);
    setParams((p) => {
      if (value === undefined || value === '' || value === null) p.delete(key);
      else p.set(key, String(value));
      return p;
    });
  }

  function goToNextPage() {
    if (!query.data?.next_cursor) return;
    setCursorStack((stack) => [...stack, filters.cursor ?? '']);
    setFilters((prev) => ({ ...prev, cursor: query.data?.next_cursor ?? undefined }));
  }

  function goToPrevPage() {
    setCursorStack((stack) => {
      const prevCursor = stack[stack.length - 1];
      setFilters((prev) => ({ ...prev, cursor: prevCursor || undefined }));
      return stack.slice(0, -1);
    });
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Review Queue</h1>
          <p className="text-sm text-slate-500">
            Reports awaiting moderator action. Use <kbd className="rounded bg-slate-100 px-1">N</kbd> in a detail page to jump to the next item.
          </p>
        </div>
        <Badge tone="info">Auto-refresh 15 s</Badge>
      </header>

      <Card>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Select
            label="Status"
            name="status"
            value={filters.status ?? ''}
            onChange={(e) => update('status', e.target.value as QueueFilters['status'])}
            options={[
              { value: '', label: 'Any' },
              { value: 'pending_moderator', label: 'Pending Moderator' },
              { value: 'ai_processing', label: 'AI Processing' },
              { value: 'assigned', label: 'Assigned' },
              { value: 'escalated', label: 'Escalated' },
            ]}
          />
          <Input
            label="Category code"
            name="category"
            value={filters.category ?? ''}
            onChange={(e) => update('category', e.target.value)}
            placeholder="e.g. road_damage"
          />
          <Input
            label="Ward"
            name="ward"
            value={filters.ward ?? ''}
            onChange={(e) => update('ward', e.target.value)}
            placeholder="e.g. W-12"
          />
          <Input
            label="Min confidence"
            name="confidence_min"
            type="number"
            min={0}
            max={100}
            value={filters.confidence_min ?? ''}
            onChange={(e) =>
              update('confidence_min', e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder="0–100"
          />
        </CardBody>
      </Card>

      {query.isLoading ? (
        <div className="flex items-center justify-center py-10" aria-live="polite">
          <Spinner label="Loading queue" />
        </div>
      ) : query.isError || !query.data ? (
        <EmptyState title="Could not load the queue" description="The /api/v1/moderator/queue endpoint did not respond." />
      ) : query.data.data.length === 0 ? (
        <EmptyState title="No reports match these filters" description="Try widening the filters or check back in a few minutes." />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Tracking</TH>
                <TH>Submitted</TH>
                <TH>Category</TH>
                <TH>Confidence</TH>
                <TH>Risk</TH>
                <TH>Status</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {query.data.data.map((r: ReportListItem) => (
                <TR
                  key={r.id}
                  onClick={() => { void navigate(`/moderator/reports/${r.id}`); }}
                >
                  <TD className="font-mono text-xs">
                    <Link
                      to={`/moderator/reports/${r.id}`}
                      className="text-brand-700 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.tracking_number}
                    </Link>
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-slate-500">
                    {new Date(r.submitted_at).toLocaleString()}
                  </TD>
                  <TD>
                    {r.category?.name ?? <span className="text-slate-400">—</span>}
                  </TD>
                  <TD>
                    {r.ai_confidence !== null ? `${r.ai_confidence.toFixed(0)}%` : '—'}
                  </TD>
                  <TD>
                    {r.fraud_score !== null && r.fraud_score > 60 ? (
                      <Badge tone="danger">Fraud {r.fraud_score.toFixed(0)}</Badge>
                    ) : r.duplicate_score !== null && r.duplicate_score > 60 ? (
                      <Badge tone="warning">Dup {r.duplicate_score.toFixed(0)}</Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={statusTone(r.status_code)}>{r.status_code.replace(/_/g, ' ')}</Badge>
                  </TD>
                  <TD className="text-right">
                    <Link
                      to={`/moderator/reports/${r.id}`}
                      className="text-sm font-medium text-brand-700 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Review →
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{query.data.data.length} reports on this page</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goToPrevPage}
                disabled={cursorStack.length === 0}
                className="rounded-md border border-slate-300 px-2 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={goToNextPage}
                disabled={!query.data.next_cursor}
                className="rounded-md border border-slate-300 px-2 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
