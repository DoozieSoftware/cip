import { NavLink, Outlet, Link } from 'react-router-dom';
import { type JSX } from 'react';
import { cx } from '../../../shared/ui/cx';

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
    <div className="min-h-screen bg-[var(--color-canvas)]">
      <header className="border-b border-[var(--color-border-subtle)] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            to="/"
            aria-label="Civic Intelligence Platform home"
            className="flex items-center gap-3"
          >
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-ink)] text-sm font-bold text-white shadow-sm"
            >
              CIP
            </span>
            <div>
              <div className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
                Civic Intelligence Platform
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
                Public transparency portal
              </div>
            </div>
          </Link>
          <nav aria-label="Public portal sections" className="flex flex-wrap gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx(
                    'rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1',
                    isActive
                      ? 'bg-[var(--color-ink)] text-white'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-ink)]',
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

      <footer className="mx-auto max-w-5xl px-6 py-8 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
        Aggregate, privacy-safe statistics only — no citizen identity, no exact locations, no
        evidence.
      </footer>
    </div>
  );
}
