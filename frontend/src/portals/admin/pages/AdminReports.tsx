import { useState, type JSX } from 'react';
import {
  useAdminDepartments,
  useAdminReportTypes,
  useAdminReports,
  useAdminUsers,
  type AdminReportFilters,
} from '../api/client';
import { EmptyState, Spinner } from '../../moderator/design';

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

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
          Cross-department oversight
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">All reports</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review report ownership and active primary or secondary assignments across the platform.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">
            Search
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                updateFilter('q', event.target.value);
              }}
              placeholder="Title or tracking number"
              className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 font-normal"
            />
          </label>
          <FilterSelect
            label="Department"
            value={filters.department_id ?? ''}
            onChange={(value) => updateFilter('department_id', value)}
            options={(departments.data ?? []).map(
              (item) => [item.id, `${item.name} (${item.code})`] as const,
            )}
          />
          <FilterSelect
            label="Status"
            value={filters.status ?? ''}
            onChange={(value) => updateFilter('status', value)}
            options={[...STATUS_OPTIONS]}
          />
          <FilterSelect
            label="Category"
            value={filters.category ?? ''}
            onChange={(value) => updateFilter('category', value)}
            options={(reportTypes.data ?? []).map((item) => [item.code, item.name] as const)}
          />
          <FilterSelect
            label="Officer"
            value={filters.officer_id ?? ''}
            onChange={(value) => updateFilter('officer_id', value)}
            options={(officers.data ?? []).map(
              (item) => [item.id, item.name ?? item.mobile] as const,
            )}
          />
          <FilterSelect
            label="Assignment"
            value={filters.assignment_type ?? ''}
            onChange={(value) => updateFilter('assignment_type', value)}
            options={[
              ['primary', 'Primary'],
              ['secondary', 'Secondary'],
            ]}
          />
          <label className="text-sm font-medium text-slate-700">
            From date
            <input
              type="date"
              value={filters.date_from ?? ''}
              onChange={(event) => updateFilter('date_from', event.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 font-normal"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            To date
            <input
              type="date"
              value={filters.date_to ?? ''}
              onChange={(event) => updateFilter('date_to', event.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 font-normal"
            />
          </label>
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 text-sm font-semibold text-blue-700 hover:underline"
          >
            Clear filters ({activeFilterCount})
          </button>
        )}
      </section>

      {reports.isLoading ? (
        <Spinner label="Loading reports" />
      ) : reports.isError || !reports.data ? (
        <EmptyState
          title="Could not load reports"
          description="The admin report endpoint did not respond."
          action={
            <button
              type="button"
              onClick={() => {
                void reports.refetch();
              }}
              className="text-sm font-semibold text-blue-700 hover:underline"
            >
              Retry
            </button>
          }
        />
      ) : reports.data.reports.length === 0 ? (
        <EmptyState title="No reports match" description="Try clearing one or more filters." />
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>
              <strong className="text-slate-950">{reports.data.meta.total}</strong> reports
            </span>
            <span>
              Page {reports.data.meta.page} of {reports.data.meta.last_page}
            </span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Report</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Primary department</th>
                  <th className="px-4 py-3">Assignments</th>
                  <th className="px-4 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.data.reports.map((report) => (
                  <tr key={report.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-950">{report.title}</div>
                      <div className="font-mono text-xs text-slate-500">
                        {report.tracking_number}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {report.current_status_code ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{report.report_type?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {report.department?.name ?? 'Unassigned'}
                      {report.department?.code ? (
                        <div className="text-xs text-slate-500">{report.department.code}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {report.assignments.length === 0 ? (
                          <span className="text-slate-400">None</span>
                        ) : (
                          report.assignments.map((assignment) => (
                            <div key={assignment.id} className="text-xs">
                              <span
                                className={`mr-1 rounded px-1.5 py-0.5 font-semibold ${assignment.kind === 'secondary' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}
                              >
                                {assignment.kind}
                              </span>
                              <span className="text-slate-700">
                                {assignment.department?.code ?? '—'} ·{' '}
                                {assignment.officer?.name ?? 'Unassigned'}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {displayDate(report.submitted_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
}): JSX.Element {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal"
      >
        <option value="">All {label.toLowerCase()}s</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
