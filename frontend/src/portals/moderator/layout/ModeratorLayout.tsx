import { NavLink, Outlet } from 'react-router-dom';
import { cx } from '../design/cx';

const NAV = [
  { to: '/moderator', label: 'Dashboard', end: true },
  { to: '/moderator/queue', label: 'Review Queue' },
  { to: '/moderator/duplicates', label: 'Duplicates' },
  { to: '/moderator/fraud', label: 'Fraud' },
  { to: '/moderator/analytics', label: 'Analytics' },
  { to: '/moderator/ai-performance', label: 'AI Performance' },
];

export function ModeratorLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-md bg-brand-600 text-sm font-bold text-white">
              CIP
            </span>
            <span className="text-sm font-semibold text-slate-700">Moderator Portal</span>
          </div>
          <div className="text-xs text-slate-500">v1.0 — keyboard: <kbd className="rounded bg-slate-100 px-1">A</kbd> approve · <kbd className="rounded bg-slate-100 px-1">R</kbd> reject · <kbd className="rounded bg-slate-100 px-1">M</kbd> merge · <kbd className="rounded bg-slate-100 px-1">E</kbd> escalate · <kbd className="rounded bg-slate-100 px-1">N</kbd> next</div>
        </div>
        <nav aria-label="Moderator sections" className="mx-auto max-w-7xl px-6">
          <ul className="flex gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cx(
                      'inline-flex items-center border-b-2 px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? 'border-brand-600 text-brand-700'
                        : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900',
                    )
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
