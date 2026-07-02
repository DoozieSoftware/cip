import { NavLink, Outlet, Link } from 'react-router-dom';
import { type JSX } from 'react';
import { cx } from '../../moderator/design/cx';

const NAV = [
  { to: '/public', label: 'Overview', end: true },
  { to: '/public/heatmap', label: 'Heat map' },
  { to: '/public/departments', label: 'Department performance' },
];

/**
 * M17 Public Transparency Portal shell (Vision §7 / PRD M7). No
 * authentication, no citizen identity, no exact coordinates —
 * everything rendered here comes from the unauthenticated
 * `/api/v1/public/*` endpoints.
 */
export function PublicLayout(): JSX.Element {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-sm">
              CIP
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900">Civic Intelligence Platform</div>
              <div className="text-xs text-slate-500">Public transparency portal</div>
            </div>
          </Link>
          <nav aria-label="Public portal sections" className="flex gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition',
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-5xl px-6 py-8 text-center text-xs text-slate-500">
        Aggregate, privacy-safe statistics only — no citizen identity, no exact locations, no evidence.
      </footer>
    </div>
  );
}
