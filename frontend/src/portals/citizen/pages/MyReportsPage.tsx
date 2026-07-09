import { Link, useSearchParams } from 'react-router-dom';
import { type JSX } from 'react';
import { EmptyState, Spinner } from '../../moderator/design';
import { useCitizenReports } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { LocationChip } from '../components/LocationMap';

export default function MyReportsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const reports = useCitizenReports(page, 10);
  const meta = reports.data?.meta ?? { page: 1, per_page: 10, total: 0, last_page: 1 };

  function goToPage(nextPage: number): void {
    const params = new URLSearchParams(searchParams);
    if (nextPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(nextPage));
    }
    setSearchParams(params);
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My reports</h1>
          <p className="text-sm text-slate-600">
            Everything you've reported. Tap a card for the full timeline.
          </p>
        </div>
        <Link
          to="/citizen/submit"
          className="rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          + New
        </Link>
      </header>

      {reports.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner label="Loading reports" />
        </div>
      ) : reports.isError || !reports.data ? (
        <EmptyState title="Could not load reports" description="Please refresh and try again." />
      ) : reports.data.data.length === 0 ? (
        <EmptyState
          title="No reports yet"
          description="After you submit, your reports will appear here with live status updates."
          action={
            <Link
              to="/citizen/submit"
              className="mt-2 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Report an issue
            </Link>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {reports.data.data.map((report) => (
              <Link
                key={report.id}
                to={`/citizen/reports/${report.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-slate-950">
                      {report.title}
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-blue-700">
                      #{report.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{report.description}</p>
                  </div>
                  <StatusBadge status={report.status} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {report.type?.name ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                      {report.type.name}
                    </span>
                  ) : null}
                  {report.priority?.name ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                      {report.priority.name}
                    </span>
                  ) : null}
                  {report.location ? (
                    <LocationChip
                      latitude={report.location.latitude}
                      longitude={report.location.longitude}
                      label={report.location.address}
                    />
                  ) : null}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {report.created_at
                      ? new Date(report.created_at).toLocaleString()
                      : 'Recently submitted'}
                  </span>
                  <span>View timeline</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
            <span className="text-slate-600">
              Page {meta.page} of {meta.last_page} · {meta.total} total
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(meta.page - 1)}
                disabled={meta.page <= 1}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => goToPage(meta.page + 1)}
                disabled={meta.page >= meta.last_page}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
