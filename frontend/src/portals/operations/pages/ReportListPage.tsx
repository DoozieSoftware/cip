import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Card,
  CardBody,
  Spinner,
  EmptyState,
  Input,
  Badge,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '../design';
import { departmentApi, type ReportListFilters } from '../api/operations';
import { ExportMenu } from '../components/ExportMenu';
import type { DepartmentReportListItem, Paginated } from '../types';

function statusTone(code: string | null | undefined): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
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

export default function ReportListPage() {
  const [filters, setFilters] = useState<ReportListFilters>({
    status: '',
    search: '',
    page: 1,
    per_page: 20,
  });

  const { data, isLoading, error, refetch } = useQuery<Paginated<DepartmentReportListItem>>({
    queryKey: ['operations', 'reports', filters],
    queryFn: () => departmentApi.listReports(filters),
  });

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
            onClick={() => { void refetch(); }}
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
          <p className="text-sm text-slate-500" aria-live="polite">{data.meta.total} total</p>
          <ExportMenu filters={filters} />
        </div>
      </div>

      <Card>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            label="Search"
            placeholder="Tracking number or title"
            value={filters.search ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
          />
          <Input
            label="Status code"
            placeholder="assigned, accepted, in_progress…"
            value={filters.status ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
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
                  <TH>Type</TH>
                  <TH>Submitted</TH>
                </TR>
              </THead>
              <TBody>
                {data.data.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Link to={`/operations/reports/${r.id}`} className="font-mono text-xs text-emerald-700 hover:underline">
                        {r.tracking_number}
                      </Link>
                    </TD>
                    <TD className="max-w-xs truncate">{r.title}</TD>
                    <TD>
                      <Badge tone={statusTone(r.current_status_code)}>{r.current_status_code ?? '—'}</Badge>
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
            onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            className="rounded border border-slate-300 px-3 py-1 text-xs font-medium disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={data.meta.current_page >= data.meta.last_page}
            onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            className="rounded border border-slate-300 px-3 py-1 text-xs font-medium disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
