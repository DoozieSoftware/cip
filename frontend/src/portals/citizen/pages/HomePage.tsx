import { Link } from 'react-router-dom';
import { type JSX } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, type ApiEnvelope } from '../../../auth/api';
import { Spinner } from '../../moderator/design';

interface ProfileResponse {
  id: string;
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
  roles: string[];
}

export default function HomePage(): JSX.Element {
  const { user, token } = useAuth();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<ProfileResponse>>('/auth/me');
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 p-6 text-white shadow-lg sm:p-8">
        <div className="relative">
          <h1 className="text-2xl font-bold sm:text-3xl">
            Namaskara{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
          </h1>
          <p className="mt-2 text-sm text-emerald-50 sm:text-base">
            See an issue in your ward? Snap it, tag it, send it. The right department picks it up.
          </p>
          <Link
            to="/citizen/submit"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
          >
            📷  Report an issue
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Quick actions</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { to: '/citizen/submit', label: 'New report', emoji: '📷', tint: 'bg-rose-50 text-rose-700' },
            { to: '/citizen/reports', label: 'My reports', emoji: '📋', tint: 'bg-blue-50 text-blue-700' },
            { to: '/citizen/notifications', label: 'Updates', emoji: '🔔', tint: 'bg-amber-50 text-amber-700' },
            { to: '/citizen/profile', label: 'Profile', emoji: '👤', tint: 'bg-violet-50 text-violet-700' },
          ].map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="group flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow"
            >
              <span aria-hidden className={`grid h-10 w-10 place-items-center rounded-xl text-lg ${c.tint}`}>
                {c.emoji}
              </span>
              <span className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Your account</h2>
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
                  <span key={r} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{r}</span>
                ))}
              </dd>
            </div>
            {token && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Token (first 16 chars)</dt>
                <dd className="break-all font-mono text-xs text-slate-500">{token.slice(0, 16)}…</dd>
              </div>
            )}
          </dl>
        ) : me.error ? (
          <p className="mt-2 text-sm text-red-600">Couldn't load profile.</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">What happens after you submit</h2>
        <ol className="mt-3 space-y-3 text-sm text-slate-700">
          <li className="flex gap-3">
            <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">1</span>
            <div>
              <strong>AI vision classifies the report</strong> — picks a category, scores fraud, detects duplicates. Median 2-3 seconds.
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
              <strong>Routed to the right department</strong> — BBMP, BTP, BWSSB, BESCOM, etc. based on category + location.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">4</span>
            <div>
              <strong>Department officer resolves</strong> — you'll get a push, SMS, and email when status changes.
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
