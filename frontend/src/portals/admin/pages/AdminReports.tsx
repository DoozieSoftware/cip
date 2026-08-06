import { useState, type ChangeEvent, type JSX } from 'react';
import {
  useAdminDepartments,
  useAdminReportTypes,
  useAdminReports,
  useAdminUsers,
  type AdminReportFilters,
} from '../api/client';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Spinner,
} from '../../moderator/design';
import {
  IconSearch,
  IconBuilding,
  IconCategory,
  IconClipboardList,
  IconCalendar,
  IconFilter,
  IconX,
} from '@tabler/icons-react';

const STATUS_OPTIONS = [
  ['submitted', 'Submitted'],
  ['ai_processing', 'AI processing'],
  ['pending_moderator', 'Pending moderator'],
  ['assigned', 'Assigned'],
  ['accepted', 'Accepted'],
  ['in_progress', 'In progress'],
  ['resolved', 'Resolved'],
  ['verified', 'Verified'],
  ['closed', 'Closed'],
  ['escalated', 'Escalated'],
  ['rejected', 'Rejected'],
  ['merged', 'Merged'],
] as const;

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  submitted: 'neutral',
  ai_processing: 'info',
  pending_moderator: 'warning',
  assigned: 'info',
  accepted: 'info',
  in_progress: 'info',
  resolved: 'success',
  verified: 'success',
  closed: 'success',
  escalated: 'danger',
  rejected: 'danger',
  merged: 'danger',
};

function displayDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—';
}

export default function AdminReports(): JSX.Element {
  const [filters, setFilters] = useState<AdminReportFilters>({ per_page: 25 });
  const [search, setSearch] = useState('');
  const reports = useAdminReports(filters);
  const departments = useAdminDepartments();
  const reportTypes = useAdminReportTypes();
  const officers = useAdminUsers('', 'department_officer');

  const updateFilter = (key: keyof AdminReportFilters, value: string): void => {
    setFilters((current) => ({ ...current, [key]: value || undefined, page: 1 }));
  };

  const clearFilters = (): void => {
    setSearch('');
    setFilters({ per_page: 25 });
  };

  const activeFilterCount =
    Object.entries(filters).filter(
      ([key, value]) => !['per_page', 'page', 'q'].includes(key) && Boolean(value),
    ).length + (search ? 1 : 0);

  const departmentOptions = (departments.data ?? []).map((item) => ({
    value: item.id,
    label: `${item.name} (${item.code})`,
  }));
  const categoryOptions = (reportTypes.data ?? []).map((item) => ({
    value: item.code,
    label: item.name,
  }));
  const officerOptions = (officers.data ?? []).map((item) => ({
    value: item.id,
    label: item.name ?? item.mobile,
  }));

  return (
    <div className="min-h-screen bg-[#f3f2ed] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#85847f]">
                Cross-department oversight
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-[-0.01em] text-[#1d1d1b]">
                All reports
              </h1>
              <p className="mt-1 text-sm text-[#6f6e69]">
                Review report ownership and active primary or secondary assignments across the
                platform.
              </p>
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <IconX className="h-4 w-4" stroke={1.6} />
                Clear {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'}
              </Button>
            )}
          </div>
        </header>

        <Card>
          <CardBody>
            <div className="flex items-center gap-2">
              <IconFilter className="h-4 w-4 text-[#85847f]" stroke={1.6} />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                Filters
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <IconSearch
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#85847f]"
                  stroke={1.6}
                />
                <Input
                  value={search}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setSearch(event.target.value);
                    updateFilter('q', event.target.value);
                  }}
                  placeholder="Title or tracking number"
                  className="w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-2.5 pl-10 text-sm text-[#1d1d1b] placeholder:text-[#85847f] focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
                />
              </div>
              <Select
                options={[{ value: '', label: 'All departments' }, ...departmentOptions]}
                value={filters.department_id ?? ''}
                onChange={(event) => updateFilter('department_id', event.target.value)}
                className="w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-2.5 text-sm text-[#1d1d1b] focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
              />
              <Select
                options={[
                  { value: '', label: 'All statuses' },
                  ...[...STATUS_OPTIONS].map(([value, label]) => ({ value, label })),
                ]}
                value={filters.status ?? ''}
                onChange={(event) => updateFilter('status', event.target.value)}
                className="w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-2.5 text-sm text-[#1d1d1b] focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
              />
              <Select
                options={[{ value: '', label: 'All categories' }, ...categoryOptions]}
                value={filters.category ?? ''}
                onChange={(event) => updateFilter('category', event.target.value)}
                className="w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-2.5 text-sm text-[#1d1d1b] focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
              />
              <Select
                options={[{ value: '', label: 'All officers' }, ...officerOptions]}
                value={filters.officer_id ?? ''}
                onChange={(event) => updateFilter('officer_id', event.target.value)}
                className="w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-2.5 text-sm text-[#1d1d1b] focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
              />
              <Select
                options={[
                  { value: '', label: 'All assignments' },
                  { value: 'primary', label: 'Primary' },
                  { value: 'secondary', label: 'Secondary' },
                ]}
                value={filters.assignment_type ?? ''}
                onChange={(event) => updateFilter('assignment_type', event.target.value)}
                className="w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-2.5 text-sm text-[#1d1d1b] focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
              />
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                  From date
                </span>
                <input
                  type="date"
                  value={filters.date_from ?? ''}
                  onChange={(event) => updateFilter('date_from', event.target.value)}
                  className="mt-1 block h-10 w-full rounded-xl border border-[#d0cec8] bg-white px-4 text-sm text-[#1d1d1b] focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                  To date
                </span>
                <input
                  type="date"
                  value={filters.date_to ?? ''}
                  onChange={(event) => updateFilter('date_to', event.target.value)}
                  className="mt-1 block h-10 w-full rounded-xl border border-[#d0cec8] bg-white px-4 text-sm text-[#1d1d1b] focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
                />
              </label>
            </div>
          </CardBody>
        </Card>

        {reports.isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Spinner label="Loading reports" />
          </div>
        ) : reports.isError || !reports.data ? (
          <ErrorState
            title="Could not load reports"
            description="The admin report endpoint did not respond."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void reports.refetch();
                }}
              >
                Retry
              </Button>
            }
          />
        ) : reports.data.reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d0cec8] bg-white p-10 text-center">
            <EmptyState title="No reports match" description="Try clearing one or more filters." />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[#efeee9]">
                    <IconClipboardList className="h-4 w-4 text-[#6f6e69]" stroke={1.6} />
                  </span>
                  <CardTitle>Reports</CardTitle>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-[#6f6e69]">
                    <strong className="font-medium text-[#1d1d1b]">
                      {reports.data.meta.total}
                    </strong>{' '}
                    reports
                  </span>
                  <span className="text-[#85847f]">
                    Page {reports.data.meta.page} of {reports.data.meta.last_page}
                  </span>
                </div>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[#f3f2ed] text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                    <tr className="border-b border-[#e4e2dc]">
                      <th className="px-5 py-3 font-medium">Report</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Category</th>
                      <th className="px-5 py-3 font-medium">Primary department</th>
                      <th className="px-5 py-3 font-medium">Assignments</th>
                      <th className="px-5 py-3 font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e4e2dc]">
                    {reports.data.reports.map((report) => (
                      <tr key={report.id} className="align-top">
                        <td className="px-5 py-3">
                          <div className="text-sm font-medium text-[#1d1d1b]">{report.title}</div>
                          <div className="font-mono text-xs text-[#85847f]">
                            {report.tracking_number}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge
                            tone={STATUS_TONE[report.current_status_code ?? ''] ?? 'neutral'}
                            className={`bg-[#efeee9] text-[#6f6e69] ring-0 ${
                              STATUS_TONE[report.current_status_code ?? ''] === 'success'
                                ? '!bg-[#edf7f0] !text-[#256b45]'
                                : STATUS_TONE[report.current_status_code ?? ''] === 'warning'
                                  ? '!bg-[#fff6e4] !text-[#805913]'
                                  : STATUS_TONE[report.current_status_code ?? ''] === 'danger'
                                    ? '!bg-[#fbeeed] !text-[#9f3731]'
                                    : STATUS_TONE[report.current_status_code ?? ''] === 'info'
                                      ? '!bg-[#eef2fb] !text-[#3b5b9f]'
                                      : ''
                            }`}
                          >
                            {report.current_status_code ?? '—'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <IconCategory className="h-3.5 w-3.5 text-[#85847f]" stroke={1.6} />
                            <span className="text-sm text-[#1d1d1b]">
                              {report.report_type?.name ?? '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <IconBuilding className="h-3.5 w-3.5 text-[#85847f]" stroke={1.6} />
                            <div>
                              <div className="text-sm text-[#1d1d1b]">
                                {report.department?.name ?? 'Unassigned'}
                              </div>
                              {report.department?.code && (
                                <div className="font-mono text-xs text-[#85847f]">
                                  {report.department.code}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {report.assignments.length === 0 ? (
                            <span className="text-sm text-[#85847f]">None</span>
                          ) : (
                            <div className="space-y-1.5">
                              {report.assignments.map((assignment) => (
                                <div key={assignment.id} className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                      assignment.kind === 'secondary'
                                        ? 'bg-[#fff6e4] text-[#805913]'
                                        : 'bg-[#eef2fb] text-[#3b5b9f]'
                                    }`}
                                  >
                                    {assignment.kind}
                                  </span>
                                  <span className="text-xs text-[#6f6e69]">
                                    {assignment.department?.code ?? '—'} ·{' '}
                                    {assignment.officer?.name ?? 'Unassigned'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <IconCalendar className="h-3.5 w-3.5 text-[#85847f]" stroke={1.6} />
                            <span className="whitespace-nowrap text-sm text-[#6f6e69]">
                              {displayDate(report.submitted_at)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
