import { NavLink, Outlet } from 'react-router-dom';
import { cx } from '../design/cx';

const NAV = [
  { to: '/operations', label: 'Dashboard', end: true },
  { to: '/operations/reports', label: 'Assigned Reports' },
  { to: '/operations/reports/export', label: 'Export' },
  { to: '/operations/analytics', label: 'Analytics' },
  { to: '/operations/map', label: 'GIS Map' },
  { to: '/operations/audit', label: 'Audit Log' },
  { to: '/operations/security', label: 'Security' },
  { to: '/operations/admin', label: 'Department Admin' },
];

export function OperationsLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-md bg-emerald-600 text-sm font-bold text-white">
              CIP
            </span>
            <span className="text-sm font-semibold text-slate-700">Operations Portal</span>
          </div>
          <div className="text-xs text-slate-500" aria-label="keyboard shortcuts">
            v1.0 — keyboard: <kbd className="rounded bg-slate-100 px-1">A</kbd> accept · <kbd className="rounded bg-slate-100 px-1">S</kbd> start · <kbd className="rounded bg-slate-100 px-1">R</kbd> resolve · <kbd className="rounded bg-slate-100 px-1">C</kbd> close · <kbd className="rounded bg-slate-100 px-1">N</kbd> note
          </div>
        </div>
        <nav aria-label="Operations sections" className="mx-auto max-w-7xl px-6">
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
                        ? 'border-emerald-600 text-emerald-700'
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
