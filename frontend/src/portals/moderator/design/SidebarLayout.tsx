import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { type JSX, type ReactNode, useState } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { cx } from './cx';

export interface SidebarNavItem {
  to: string;
  label: string;
  icon?: ReactNode;
  group?: string;
  end?: boolean;
}

export interface SidebarLayoutProps {
  brand: string;
  brandMark?: string;
  brandSubtitle?: string;
  brandColor: 'fuchsia' | 'emerald' | 'brand' | 'sky';
  nav: SidebarNavItem[];
  accent: 'fuchsia' | 'emerald' | 'brand' | 'sky';
  user: { name?: string | null; mobile?: string | null; roleLabel: string };
  keyboardShortcuts?: ReactNode;
  headerContent?: ReactNode;
  sidebarTone?: 'light' | 'dark';
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
  const darkSidebar = props.sidebarTone === 'dark';
  const navGroups = props.nav.reduce<Array<{ label: string; items: SidebarNavItem[] }>>((groups, item) => {
    const label = item.group ?? '';
    const current = groups.at(-1);
    if (current?.label === label) {
      current.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
    return groups;
  }, []);

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
          'fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r transition-transform duration-200 lg:static lg:translate-x-0',
          darkSidebar ? 'border-blue-800 bg-blue-900' : 'border-slate-200 bg-white',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className={cx('flex items-center gap-3 border-b px-4 py-4', darkSidebar ? 'border-blue-800' : 'border-slate-200')}>
          <span aria-hidden className={cx('grid h-9 w-9 place-items-center rounded-lg text-sm font-bold', darkSidebar ? 'bg-white text-blue-900' : cx('text-white', brandAccent.brandBg))}>
            {props.brandMark ?? (props.brand.length > 2 ? props.brand.slice(0, 2) : props.brand)}
          </span>
          <div className="min-w-0">
            <div className={cx('truncate text-sm font-semibold', darkSidebar ? 'text-white' : 'text-slate-900')}>{props.brand}</div>
            {props.brandSubtitle && (
              <div className={cx('truncate text-xs', darkSidebar ? 'text-blue-100/75' : 'text-slate-500')}>{props.brandSubtitle}</div>
            )}
          </div>
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setOpen(false)}
            className={cx('ml-auto rounded-md p-1 lg:hidden', darkSidebar ? 'text-blue-100 hover:bg-blue-800' : 'text-slate-500 hover:bg-slate-100')}
          >
            ✕
          </button>
        </div>

        <nav aria-label={props.brand} className="flex-1 overflow-y-auto px-2 py-3">
          <div className="space-y-4">
            {navGroups.map((group) => <section key={group.label || 'navigation'}>
              {group.label ? <div className={cx('mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em]', darkSidebar ? 'text-blue-200/60' : 'text-slate-400')}>{group.label}</div> : null}
              <ul className="space-y-0.5">
                {group.items.map((n) => <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition',
                      darkSidebar
                        ? isActive ? 'border-blue-200 bg-blue-800 text-white' : 'border-transparent text-blue-100/80 hover:bg-blue-800 hover:text-white'
                        : isActive
                        ? cx(accent.activeBg, accent.activeText, accent.activeBorder)
                        : cx('border-transparent text-slate-600', accent.hover),
                    )
                  }
                >
                  {n.icon && <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center">{n.icon}</span>}
                  <span className="truncate">{n.label}</span>
                </NavLink>
                </li>)}
              </ul>
            </section>)}
          </div>
        </nav>

        <div className={cx('border-t px-4 py-3', darkSidebar ? 'border-blue-800' : 'border-slate-200')}>
          <div className="mb-2 flex items-center gap-2">
            <span aria-hidden className={cx('grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white', brandAccent.brandBg)}>
              {(props.user.name ?? props.user.mobile ?? '?').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className={cx('truncate text-xs font-semibold', darkSidebar ? 'text-slate-100' : 'text-slate-900')}>
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
              className={cx('flex-1 rounded-md border px-2 py-1.5 text-xs font-medium', darkSidebar ? 'border-blue-700 text-blue-100 hover:bg-blue-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50')}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => { logout(); void navigate('/'); }}
              className={cx('flex-1 rounded-md border px-2 py-1.5 text-xs font-medium', darkSidebar ? 'border-blue-700 text-blue-100 hover:bg-blue-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50')}
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
            {props.headerContent ?? (props.keyboardShortcuts && (
              <div className="hidden text-xs text-slate-500 sm:block">{props.keyboardShortcuts}</div>
            ))}
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
