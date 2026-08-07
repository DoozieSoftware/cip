import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  IconSearch,
  IconFilter,
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
  IconFileText,
  IconAlertTriangle,
  IconCircleCheck,
  IconClock,
  IconArrowUpRight,
} from '@tabler/icons-react';
import { Badge, Card, CardBody, EmptyState, Spinner } from '../shared/ui';
import { queueApi, type QueueFilters } from '../api/moderator';
import type { ReportListItem, ReportStatusCode } from '../types';
import { useState } from 'react';

function statusIcon(s: ReportStatusCode) {
  switch (s) {
    case 'pending_moderator':
      return IconClock;
    case 'ai_processing':
      return IconRefresh;
    case 'escalated':
      return IconAlertTriangle;
    case 'rejected':
    case 'merged':
      return IconCircleCheck;
    case 'closed':
    case 'verified':
    case 'resolved':
      return IconCircleCheck;
    default:
      return IconClock;
  }
}

const STATUS_FILTERS = [
  { value: 'pending_moderator', label: 'Pending' },
  { value: 'ai_processing', label: 'AI Processing' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'escalated', label: 'Escalated' },
];

export default function ReviewQueuePage() {
  const [params, setParams] = useSearchParams();

  const [filters, setFilters] = useState<QueueFilters>({
    status: params.get('status') ?? 'pending_moderator',
    category: params.get('category') ?? '',
    ward: params.get('ward') ?? '',
    confidence_min: params.get('confidence_min') ? Number(params.get('confidence_min')) : undefined,
    per_page: 20,
  });
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
    <div className="min-h-screen bg-[#f3f2ed] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#85847f]">
              Moderator · Queue
            </p>
            <h1 className="mt-2 text-2xl font-medium tracking-[-0.02em] text-[#1d1d1b]">
              Reports awaiting review
            </h1>
            <p className="mt-1 text-sm text-[#6f6e69]">
              Reports awaiting moderator action. Use{' '}
              <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-[#1d1d1b] ring-1 ring-[#d8d6cf]">
                N
              </kbd>{' '}
              in a detail page to jump to the next item.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs text-[#6f6e69] ring-1 ring-[#d8d6cf]">
              <IconRefresh className="h-3.5 w-3.5" stroke={1.6} />
              Auto-refresh 15s
            </span>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => {
            const active = filters.status === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => update('status', f.value)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm transition ${
                  active
                    ? 'bg-[#1d1d1b] text-white'
                    : 'bg-white text-[#6f6e69] ring-1 ring-[#d8d6cf] hover:bg-[#efeee9]'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <Card>
          <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="relative">
              <IconSearch
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#85847f]"
                stroke={1.6}
              />
              <input
                type="text"
                value={filters.category ?? ''}
                onChange={(e) => update('category', e.target.value)}
                placeholder="Category code (e.g. roads)"
                className="min-h-[44px] w-full rounded-lg border-0 bg-[#f3f2ed] pl-10 pr-4 text-sm text-[#1d1d1b] placeholder:text-[#85847f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1b]/20"
              />
            </div>
            <div className="relative">
              <IconFilter
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#85847f]"
                stroke={1.6}
              />
              <input
                type="text"
                value={filters.ward ?? ''}
                onChange={(e) => update('ward', e.target.value)}
                placeholder="Ward (e.g. 12 or W-12)"
                className="min-h-[44px] w-full rounded-lg border-0 bg-[#f3f2ed] pl-10 pr-4 text-sm text-[#1d1d1b] placeholder:text-[#85847f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1b]/20"
              />
            </div>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                value={filters.confidence_min ?? ''}
                onChange={(e) =>
                  update('confidence_min', e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="Min confidence (0-100)"
                className="min-h-[44px] w-full rounded-lg border-0 bg-[#f3f2ed] px-4 text-sm text-[#1d1d1b] placeholder:text-[#85847f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1b]/20"
              />
            </div>
          </CardBody>
        </Card>

        {query.isLoading ? (
          <div className="flex items-center justify-center py-16" aria-live="polite">
            <Spinner label="Loading reports awaiting review" />
          </div>
        ) : query.isError || !query.data ? (
          <EmptyState
            title="Could not load reports awaiting review"
            description="The /api/v1/moderator/queue endpoint did not respond."
          />
        ) : query.data.data.length === 0 ? (
          <EmptyState
            title="No reports match these filters"
            description="Try widening the filters or check back in a few minutes."
          />
        ) : (
          <>
            <div className="space-y-3">
              {query.data.data.map((r: ReportListItem) => {
                const StatusIcon = statusIcon(r.status_code);
                return (
                  <Link
                    key={r.id}
                    to={`/moderator/reports/${r.id}`}
                    className="group block rounded-xl bg-white p-4 ring-1 ring-[#e4e2dc] transition hover:ring-[#d8d6cf] hover:shadow-sm"
                  >
                    <div className="flex min-h-[44px] items-center gap-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#efeee9]">
                        <IconFileText className="h-5 w-5 text-[#6f6e69]" stroke={1.6} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-[#1d1d1b]">{r.title}</p>
                          <IconArrowUpRight
                            className="h-4 w-4 shrink-0 text-[#aaa9a4] opacity-0 transition group-hover:opacity-100"
                            stroke={1.5}
                          />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#85847f]">
                            {r.tracking_number}
                          </span>
                          {r.category && (
                            <span className="text-xs text-[#6f6e69]">{r.category.name}</span>
                          )}
                          <span className="text-xs text-[#85847f]">
                            {new Date(r.submitted_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {r.ai_confidence !== null && (
                          <span className="hidden font-mono text-xs text-[#6f6e69] sm:inline">
                            {r.ai_confidence.toFixed(0)}%
                          </span>
                        )}
                        {r.duplicate_score !== null && r.duplicate_score > 60 && (
                          <Badge tone="warning">Dup {r.duplicate_score.toFixed(0)}</Badge>
                        )}
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                            r.status_code === 'pending_moderator' ||
                            r.status_code === 'ai_processing'
                              ? 'bg-amber-50 text-amber-700'
                              : r.status_code === 'escalated'
                                ? 'bg-violet-50 text-violet-700'
                                : r.status_code === 'rejected' || r.status_code === 'merged'
                                  ? 'bg-red-50 text-red-700'
                                  : r.status_code === 'closed' ||
                                      r.status_code === 'verified' ||
                                      r.status_code === 'resolved'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-sky-50 text-sky-700'
                          }`}
                        >
                          <StatusIcon className="h-3 w-3" stroke={1.8} />
                          {r.status_code.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-[#85847f]">
                {query.data.data.length} reports on this page
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={goToPrevPage}
                  disabled={cursorStack.length === 0}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white px-4 text-sm text-[#1d1d1b] ring-1 ring-[#d8d6cf] transition hover:bg-[#efeee9] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <IconChevronLeft className="h-4 w-4" stroke={1.6} />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={goToNextPage}
                  disabled={!query.data.next_cursor}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white px-4 text-sm text-[#1d1d1b] ring-1 ring-[#d8d6cf] transition hover:bg-[#efeee9] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <IconChevronRight className="h-4 w-4" stroke={1.6} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
