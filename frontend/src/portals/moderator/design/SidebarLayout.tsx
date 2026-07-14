import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { type JSX, type ReactNode, useState } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { cx } from './cx';

export interface SidebarNavItem {
  to: string;
  label: string;
  icon?: string;
  end?: boolean;
}

export interface SidebarLayoutProps {
  brand: string;
  brandSubtitle?: string;
  brandColor: 'fuchsia' | 'emerald' | 'brand' | 'sky';
  nav: SidebarNavItem[];
  accent: 'fuchsia' | 'emerald' | 'brand' | 'sky';
  user: { name?: string | null; mobile?: string | null; roleLabel: string };
  keyboardShortcuts?: ReactNode;
  children?: ReactNode;
}

const ACCENT_MAP = {
  fuchsia: {
    activeBg: 'bg-fuchsia-50',
    activeText: 'text-fuchsia-700',
    activeBorder: 'border-fuchsia-600',
    brandBg: 'bg-fuchsia-600',
    badge: 'bg-fuchsia-100 text-fuchsia-700',
    hover: 'hover:bg-slate-100',
  },
  emerald: {
    activeBg: 'bg-emerald-50',
    activeText: 'text-emerald-700',
    activeBorder: 'border-emerald-600',
    brandBg: 'bg-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700',
    hover: 'hover:bg-slate-100',
  },
  brand: {
    activeBg: 'bg-brand-50',
    activeText: 'text-brand-700',
    activeBorder: 'border-brand-600',
    brandBg: 'bg-brand-600',
    badge: 'bg-brand-100 text-brand-700',
    hover: 'hover:bg-slate-100',
  },
  sky: {
    activeBg: 'bg-sky-50',
    activeText: 'text-sky-700',
    activeBorder: 'border-sky-600',
    brandBg: 'bg-sky-600',
    badge: 'bg-sky-100 text-sky-700',
    hover: 'hover:bg-slate-100',
  },
} as const;

export function SidebarLayout(props: SidebarLayoutProps): JSX.Element {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const accent = ACCENT_MAP[props.accent] ?? ACCENT_MAP.brand;
  const brandAccent = ACCENT_MAP[props.brandColor] ?? ACCENT_MAP.brand;

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-slate-50 text-slate-900">
      {/* Mobile overlay */}
      {open && (
        <div
          aria-hidden
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-4">
          <span aria-hidden className={cx('grid h-9 w-9 place-items-center rounded-xl text-sm font-bold text-white', brandAccent.brandBg)}>
            {props.brand.length > 2 ? props.brand.slice(0, 2) : props.brand}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">{props.brand}</div>
            {props.brandSubtitle && (
              <div className="truncate text-xs text-slate-500">{props.brandSubtitle}</div>
            )}
          </div>
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setOpen(false)}
            className="ml-auto rounded-md p-1 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav aria-label={props.brand} className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-0.5">
            {props.nav.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? cx(accent.activeBg, accent.activeText, accent.activeBorder)
                        : cx('border-transparent text-slate-600', accent.hover),
                    )
                  }
                >
                  {n.icon && <span aria-hidden className="text-base">{n.icon}</span>}
                  <span className="truncate">{n.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-slate-200 px-4 py-3">
          <div className="mb-2 flex items-center gap-2">
            <span aria-hidden className={cx('grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white', brandAccent.brandBg)}>
              {(props.user.name ?? props.user.mobile ?? '?').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-900">
                {props.user.name ?? props.user.mobile ?? '—'}
              </div>
              <div className="flex items-center gap-1">
                <span className={cx('rounded px-1.5 py-0.5 text-[10px] font-medium', accent.badge)}>
                  {props.user.roleLabel}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => { void navigate('/'); }}
              className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => { logout(); void navigate('/'); }}
              className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 w-full flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setOpen(true)}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              ☰
            </button>
            {props.keyboardShortcuts && (
              <div className="hidden text-xs text-slate-500 sm:block">{props.keyboardShortcuts}</div>
            )}
            <div className="ml-auto flex items-center gap-2 sm:hidden">
              <span aria-hidden className={cx('grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white', brandAccent.brandBg)}>
                {(props.user.name ?? props.user.mobile ?? '?').slice(0, 1).toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        <main className="w-full flex-1 overflow-y-auto px-4 py-6 lg:px-6">
          {props.children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
