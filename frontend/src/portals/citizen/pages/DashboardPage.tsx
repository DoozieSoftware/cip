import { Link } from 'react-router-dom';
import { type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../auth/AuthContext';
import { apiRequest, type ApiEnvelope } from '../../../auth/api';
import { Spinner, EmptyState } from '../../moderator/design';
import { StatusBadge } from '../components/StatusBadge';
import { getQueue } from '../offline/queue';
import { normalizeReport } from '../api/client';

interface ReportSummary {
  id: string;
  title: string;
  status: { code: string; name: string };
  type?: { code: string; name: string };
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * T-M13-014 — Citizen dashboard.
 *
 * What it shows:
 *  - a one-line welcome,
 *  - a CTA to submit a new report,
 *  - the citizen's 3 most-recent reports,
 *  - a count of items in the offline queue (when > 0).
 *
 * The dashboard is intentionally quiet so it renders fast
 * on the citizen's phone.
 */
export default function DashboardPage(): JSX.Element {
  const { user } = useAuth();
  const reports = useQuery({
    queryKey: ['citizen', 'reports', 'recent'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<ReportSummary[]>>('/citizen/reports', { query: { per_page: 3 } });
      return res.data.map((report) => normalizeReport(report));
    },
  });
  const queue = useQuery({
    queryKey: ['citizen', 'queue', 'size'],
    queryFn: async () => getQueue().size(),
    refetchInterval: 5_000,
  });

  const list = reports.data ?? [];
  const queueSize = queue.data ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome, {user?.name ?? 'citizen'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">Report a civic issue in under 60 seconds.</p>
      </header>

      {queueSize > 0 ? (
        <div role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {queueSize} item{queueSize === 1 ? '' : 's'} waiting to sync. They will upload when your connection is back.
        </div>
      ) : null}

      <Link
        to="/citizen/submit"
        className="block rounded-lg bg-blue-600 px-5 py-4 text-center text-base font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        + Report a new issue
      </Link>

      <section aria-labelledby="recent-reports">
        <h2 id="recent-reports" className="text-sm font-semibold text-slate-700">Recent reports</h2>
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {reports.isLoading ? (
            <div className="flex items-center justify-center py-10"><Spinner label="Loading reports" /></div>
          ) : list.length === 0 ? (
            <EmptyState
              title="No reports yet"
              description="Your submitted reports will appear here."
              action={
                <Link to="/citizen/submit" className="mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                  Report your first issue
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-200">
              {list.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link to={`/citizen/reports/${r.id}`} className="block truncate text-sm font-medium text-slate-900 hover:underline">
                      {r.title}
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
