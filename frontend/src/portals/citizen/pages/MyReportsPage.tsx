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
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">My reports</h1>
          <p className="mt-1 text-sm text-slate-600">
            Everything you've reported. Tap a card for the full timeline.
          </p>
        </div>
        <Link
          to="/citizen/submit"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          New report
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
                className="group block overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-blue-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-blue-700">Reference #{report.id.slice(0, 8).toUpperCase()}</p>
                    <h2 className="mt-1 truncate text-base font-semibold text-slate-950 group-hover:text-blue-900">
                      {report.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{report.description}</p>
                  </div>
                  <StatusBadge status={report.status} />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  {report.type?.name ? (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-700">
                      {report.type.name}
                    </span>
                  ) : null}
                  {report.priority?.name ? (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-700">
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

                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-xs text-slate-500 sm:px-5">
                  <span>
                    {report.created_at
                      ? new Date(report.created_at).toLocaleString()
                      : 'Recently submitted'}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-blue-700 group-hover:text-blue-900">View timeline <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg></span>
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
