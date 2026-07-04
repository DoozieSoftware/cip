import { Link } from 'react-router-dom';
import { type JSX } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, type ApiEnvelope } from '../../../auth/api';
import { Spinner } from '../../moderator/design';
import { getQueue } from '../offline/queue';

interface ProfileResponse {
  id: string;
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
  roles: string[];
}

export default function HomePage(): JSX.Element {
  const { user } = useAuth();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<ProfileResponse>>('/auth/me');
      return res.data;
    },
  });
  const queue = useQuery({
    queryKey: ['citizen', 'queue', 'size'],
    queryFn: async () => getQueue().size(),
    refetchInterval: 5_000,
  });

  const queueSize = queue.data ?? 0;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Good morning</p>
            <h1 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">
              {user?.name ? user.name.split(' ')[0] : 'Citizen'} dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">Capture an issue, verify the location, and track department action.</p>
          </div>
          <Link
            to="/citizen/notifications"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-lg text-slate-600 hover:bg-slate-50"
            aria-label="Open updates"
          >
            ◉
          </Link>
        </div>

        <Link
          to="/citizen/submit"
          className="mt-4 flex items-center justify-between rounded-lg bg-blue-600 px-4 py-4 text-white transition hover:bg-blue-700"
        >
          <span className="flex items-center gap-3">
            <span aria-hidden className="grid h-11 w-11 place-items-center rounded-lg bg-white/15 text-2xl">◎</span>
            <span>
              <span className="block text-base font-semibold">New Report</span>
              <span className="block text-xs text-blue-100">Capture an issue in your area</span>
            </span>
          </span>
          <span aria-hidden className="text-xl">›</span>
        </Link>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-950">Overview</h2>
          <span className="text-xs text-slate-500">Today</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'My Reports', value: '12', tone: 'bg-blue-50 text-blue-700', icon: '▤' },
            { label: 'Resolved', value: '5', tone: 'bg-green-50 text-green-700', icon: '✓' },
            { label: 'Pending', value: '4', tone: 'bg-amber-50 text-amber-700', icon: '◷' },
            { label: 'Drafts', value: String(queueSize), tone: 'bg-slate-100 text-slate-700', icon: '□' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 p-3">
              <span aria-hidden className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${item.tone}`}>
                {item.icon}
              </span>
              <div className="mt-2 text-xl font-bold text-slate-950">{item.value}</div>
              <div className="text-xs text-slate-500">{item.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-cyan-50 text-cyan-700">≈</span>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {queueSize > 0 ? `${queueSize} waiting to sync` : 'Offline ready'}
              </div>
              <div className="text-xs text-slate-500">Reports sync when your connection is back.</div>
            </div>
          </div>
          <span aria-hidden className="text-slate-400">›</span>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-950">Your account</h2>
        {me.isLoading ? (
          <div className="mt-3"><Spinner label="Loading profile" /></div>
        ) : me.data ? (
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Name</dt>
              <dd className="font-medium text-slate-900">{me.data.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Mobile</dt>
              <dd className="font-mono text-slate-900">{me.data.mobile ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Email</dt>
              <dd className="text-slate-900">{me.data.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Roles</dt>
              <dd className="flex flex-wrap gap-1">
                {me.data.roles.map((r) => (
                  <span key={r} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{r}</span>
                ))}
              </dd>
            </div>
          </dl>
        ) : me.error ? (
          <p className="mt-2 text-sm text-red-600">Couldn't load profile.</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-950">What happens after you submit</h2>
        <ol className="mt-3 space-y-3 text-sm text-slate-700">
          <li className="flex gap-3">
            <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">1</span>
            <div>
              <strong>Evidence is checked</strong> — photo, video, GPS and device signals are validated.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700">2</span>
            <div>
              <strong>Moderator reviews</strong> — approves, merges with a duplicate, or escalates.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">3</span>
            <div>
              <strong>Routed to the right department</strong> — assignment is based on category and location.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-green-100 text-xs font-semibold text-green-700">4</span>
            <div>
              <strong>Track every status change</strong> — updates appear here and in notifications.
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
