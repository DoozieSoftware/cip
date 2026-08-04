import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  CardBody,
  Spinner,
  EmptyState,
  Input,
  Select,
  Badge,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '../design';
import { api } from '../api/client';
import { departmentApi, type ReportListFilters } from '../api/operations';
import { ExportMenu } from '../components/ExportMenu';
import { SlaBadge } from '../components/SlaBadge';
import type { DepartmentReportListItem, Paginated, ReportType } from '../types';

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'verified', label: 'Verified' },
  { value: 'closed', label: 'Closed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'merged', label: 'Merged' },
  { value: 'escalated', label: 'Escalated' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Any priority' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function statusTone(
  code: string | null | undefined,
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (code) {
    case 'assigned':
    case 'accepted':
    case 'in_progress':
      return 'info';
    case 'resolved':
    case 'verified':
      return 'success';
    case 'closed':
      return 'neutral';
    case 'rejected':
    case 'merged':
      return 'warning';
    case 'escalated':
      return 'danger';
    default:
      return 'neutral';
  }
}

function useReportTypeOptions() {
  return useQuery({
    queryKey: ['operations', 'report-types'],
    queryFn: async (): Promise<ReportType[]> => {
      const res = await api.get<{ success: boolean; data: ReportType[] }>('/report-types');
      return res.data;
    },
  });
}

export default function ReportListPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ReportListFilters>(() => ({
    status: params.get('status') ?? '',
    priority: params.get('priority') ?? '',
    category: params.get('category') ?? '',
    search: params.get('search') ?? '',
    date_from: params.get('date_from') ?? '',
    date_to: params.get('date_to') ?? '',
    page: params.get('page') ? Math.max(1, Number(params.get('page')) || 1) : 1,
    per_page: 20,
  }));

  const reportTypes = useReportTypeOptions();

  const { data, isLoading, error, refetch } = useQuery<Paginated<DepartmentReportListItem>>({
    queryKey: ['operations', 'reports', filters],
    queryFn: () => departmentApi.listReports(filters),
  });

  function updateFilter<K extends keyof ReportListFilters>(key: K, value: ReportListFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
    setParams((p) => {
      if (value === undefined || value === null || value === '') p.delete(String(key));
      else p.set(String(key), String(value));
      p.delete('page');
      return p;
    });
  }

  function goToPage(page: number) {
    setFilters((prev) => ({ ...prev, page }));
    setParams((p) => {
      if (page <= 1) p.delete('page');
      else p.set('page', String(page));
      return p;
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading reports" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Could not load reports"
        description="The reports endpoint did not respond."
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">Assigned reports</h1>
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500" aria-live="polite">
            {data.meta.total} total
          </p>
          <ExportMenu filters={filters} />
        </div>
      </div>

      <Card>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select
            label="Status"
            name="status"
            value={filters.status ?? ''}
            onChange={(e) => updateFilter('status', e.target.value)}
            options={STATUS_OPTIONS}
          />
          <Select
            label="Priority"
            name="priority"
            value={filters.priority ?? ''}
            onChange={(e) => updateFilter('priority', e.target.value)}
            options={PRIORITY_OPTIONS}
          />
          <Select
            label="Category"
            name="category"
            value={filters.category ?? ''}
            onChange={(e) => updateFilter('category', e.target.value)}
            options={[
              { value: '', label: 'Any category' },
              ...(reportTypes.data ?? []).map((t) => ({ value: t.code, label: t.name })),
            ]}
          />
          <Input
            label="Search"
            name="search"
            placeholder="Tracking number or title"
            value={filters.search ?? ''}
            onChange={(e) => updateFilter('search', e.target.value)}
          />
          <Input
            label="From date"
            name="date_from"
            type="date"
            value={filters.date_from ?? ''}
            onChange={(e) => updateFilter('date_from', e.target.value)}
          />
          <Input
            label="To date"
            name="date_to"
            type="date"
            value={filters.date_to ?? ''}
            onChange={(e) => updateFilter('date_to', e.target.value)}
          />
        </CardBody>
      </Card>

      {data.data.length === 0 ? (
        <EmptyState title="No reports match" description="Try clearing your filters." />
      ) : (
        <Card>
          <CardBody className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Tracking</TH>
                  <TH>Title</TH>
                  <TH>Status</TH>
                  <TH>SLA</TH>
                  <TH>Type</TH>
                  <TH>Submitted</TH>
                </TR>
              </THead>
              <TBody>
                {data.data.map((r) => (
                  <TR
                    key={r.id}
                    onClick={() => {
                      void navigate(`/operations/reports/${r.id}`);
                    }}
                  >
                    <TD>
                      <Link
                        to={`/operations/reports/${r.id}`}
                        className="font-mono text-xs text-emerald-700 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.tracking_number}
                      </Link>
                    </TD>
                    <TD className="max-w-xs truncate">{r.title}</TD>
                    <TD>
                      <Badge tone={statusTone(r.current_status_code)}>
                        {r.current_status_code ?? '—'}
                      </Badge>
                    </TD>
                    <TD>
                      <SlaBadge report={r} />
                    </TD>
                    <TD>{r.report_type?.code ?? '—'}</TD>
                    <TD className="text-xs text-slate-500">
                      {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Page {data.meta.current_page} of {data.meta.last_page} ({data.meta.per_page} per page)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={data.meta.current_page <= 1}
            onClick={() => goToPage((filters.page ?? 1) - 1)}
            className="rounded border border-slate-300 px-3 py-1 text-xs font-medium disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={data.meta.current_page >= data.meta.last_page}
            onClick={() => goToPage((filters.page ?? 1) + 1)}
            className="rounded border border-slate-300 px-3 py-1 text-xs font-medium disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
