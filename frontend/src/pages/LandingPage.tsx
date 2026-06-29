import { Link, useNavigate } from 'react-router-dom';
import { type JSX } from 'react';
import { useAuth, type Role } from '../auth/AuthContext';
import { routeForRoles } from './LoginPage';

interface Portal {
  title: string;
  path: string;
  audience: string;
  description: string;
  highlight: string;
  roles: Role[];
  gradient: string;
  emoji: string;
}

const PORTALS: Portal[] = [
  {
    title: 'Citizen PWA',
    path: '/citizen',
    audience: 'Citizens',
    description: 'Submit geo-tagged reports, track status, and receive notifications.',
    highlight: 'Photo + video, GPS, OTP login, no app install.',
    roles: ['citizen'],
    gradient: 'from-emerald-500 to-teal-600',
    emoji: '📱',
  },
  {
    title: 'Moderator Portal',
    path: '/moderator',
    audience: 'Moderators',
    description: 'Triage the AI-classified queue, merge duplicates, reject fraud.',
    highlight: 'Keyboard shortcuts · AI overlay · Bulk actions',
    roles: ['moderator', 'super_admin', 'system'],
    gradient: 'from-brand-600 to-indigo-700',
    emoji: '🛡️',
  },
  {
    title: 'Operations Portal',
    path: '/operations',
    audience: 'Departments',
    description: 'Officers accept, progress, and resolve assigned reports. GIS map and exports.',
    highlight: 'BBMP / BTP / BWSSB · SLA · CSV / Excel / PDF',
    roles: ['department_officer', 'department_admin', 'super_admin', 'system'],
    gradient: 'from-amber-500 to-orange-600',
    emoji: '🏛️',
  },
  {
    title: 'Super Admin',
    path: '/admin',
    audience: 'Platform admins',
    description: 'Configure report types, roles, security policies, feature flags, and audit log.',
    highlight: '12 admin CRUD namespaces · live feature flags',
    roles: ['super_admin', 'system'],
    gradient: 'from-fuchsia-600 to-purple-700',
    emoji: '⚙️',
  },
];

export function LandingPage(): JSX.Element {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow">
              CIP
            </span>
            <div>
              <div className="text-base font-semibold text-slate-900">Civic Intelligence Platform</div>
              <div className="text-xs text-slate-500">Demo build · Bengaluru pilot</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="hidden text-sm text-slate-600 sm:inline">
                  Signed in as <strong>{user?.name ?? user?.mobile ?? '—'}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => { void navigate(routeForRoles(user?.roles ?? [])); }}
                  className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                >
                  Open my portal
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Live demo · v1.0 · stakeholder preview
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            See the city respond.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Geo-tagged reports. AI-assisted moderation. Department routing. End-to-end civic workflow — for citizens, moderators, departments, and platform admins.
          </p>
        </section>

        <section className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {PORTALS.map((p) => (
            <Link
              key={p.path}
              to={isAuthenticated && user ? (p.roles.some((r) => user.roles.includes(r)) ? p.path : '/login') : p.path}
              className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:border-brand-300 hover:shadow-lg"
            >
              <div className={`absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${p.gradient} opacity-20 transition group-hover:opacity-30`} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="text-3xl" aria-hidden>{p.emoji}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{p.audience}</span>
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-slate-900">{p.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{p.description}</p>
                <p className="mt-3 text-xs font-medium text-slate-500">{p.highlight}</p>
                <p className="mt-4 text-sm font-semibold text-brand-700 group-hover:underline">Open portal →</p>
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-20 grid grid-cols-1 gap-6 rounded-3xl border border-slate-200 bg-white p-8 sm:grid-cols-3">
          {[
            { label: 'Reports processed', value: '12,847', sub: 'in the last 30 days' },
            { label: 'AI-classified', value: '94%', sub: 'before human review' },
            { label: 'Median time to assign', value: '38s', sub: 'submit → department' },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <div className="text-3xl font-bold tracking-tight text-brand-700 sm:text-4xl">{m.value}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{m.label}</div>
              <div className="text-xs text-slate-500">{m.sub}</div>
            </div>
          ))}
        </section>

        <footer className="mt-16 text-center text-xs text-slate-500">
          Built for the Government of Karnataka · Demo seed data · 2026
        </footer>
      </main>
    </div>
  );
}
