import { useMemo, type JSX } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  IconBuildingCommunity,
  IconChartBar,
  IconClipboardList,
  IconDatabaseExport,
  IconFileAnalytics,
  IconHome,
  IconLock,
  IconLogout,
  IconMap,
  IconShield,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';
import { useAuth, type Role } from '../../../auth/AuthContext';
import { DepartmentSwitcher } from '../components/DepartmentSwitcher';

interface NavItem {
  to: string;
  label: string;
  icon: typeof IconHome;
  end?: boolean;
  allowedRoles?: Role[];
  mobile?: boolean;
}

const AUDIT_SECURITY_ROLES: Role[] = ['super_admin', 'system', 'auditor', 'department_admin'];
const DEPARTMENT_ADMIN_ROLES: Role[] = ['super_admin', 'system', 'department_admin'];

const NAV: NavItem[] = [
  { to: '/operations', label: 'Dashboard', end: true, icon: IconHome, mobile: true },
  { to: '/operations/reports', label: 'Assigned', icon: IconClipboardList, mobile: true },
  { to: '/operations/tasks', label: 'Cross Agency', icon: IconFileAnalytics, mobile: true },
  { to: '/operations/analytics', label: 'Analytics', icon: IconChartBar },
  { to: '/operations/map', label: 'GIS Map', icon: IconMap },
  { to: '/operations/reports/export', label: 'Export', icon: IconDatabaseExport },
  { to: '/operations/profile', label: 'Profile', icon: IconUser },
  { to: '/operations/audit', label: 'Audit', icon: IconShield, allowedRoles: AUDIT_SECURITY_ROLES },
  {
    to: '/operations/security',
    label: 'Security',
    icon: IconLock,
    allowedRoles: AUDIT_SECURITY_ROLES,
  },
  {
    to: '/operations/admin',
    label: 'Admin',
    icon: IconUsers,
    allowedRoles: DEPARTMENT_ADMIN_ROLES,
    mobile: true,
  },
];

const MOBILE_NAV: NavItem[] = [
  { to: '/operations', label: 'Home', end: true, icon: IconHome },
  { to: '/operations/reports', label: 'Reports', icon: IconClipboardList },
  { to: '/operations/tasks', label: 'Cross Agency', icon: IconFileAnalytics },
  { to: '/operations/analytics', label: 'Analytics', icon: IconChartBar },
  {
    to: '/operations/admin',
    label: 'Admin',
    icon: IconUsers,
    allowedRoles: DEPARTMENT_ADMIN_ROLES,
  },
];

export function OperationsLayout(): JSX.Element {
  const { user, hasAnyRole, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const nav = useMemo(
    () => NAV.filter((item) => item.allowedRoles === undefined || hasAnyRole(item.allowedRoles)),
    [hasAnyRole],
  );

  const portalRole = (
    ['super_admin', 'system', 'department_admin', 'department_officer', 'auditor'] as Role[]
  ).find((role) => user?.roles.includes(role));
  const roleLabel = portalRole?.replace(/_/g, ' ') ?? 'operations';

  const handleSignOut = () => {
    logout();
    void queryClient.clear();
    void navigate('/');
  };

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] lg:flex">
      {/* Desktop sidebar (lg+) */}
      <aside className="hidden w-64 shrink-0 flex-col bg-[var(--color-ink)] lg:flex">
        <div className="border-b border-white/10 px-6 py-7">
          <div className="flex items-center gap-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white text-[var(--color-ink)]">
              <IconBuildingCommunity className="h-5 w-5" stroke={1.7} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-[-0.01em] text-white">
                CIP Karnataka
              </div>
              <div className="truncate text-xs text-white/50">Operations</div>
            </div>
          </div>
        </div>

        <nav aria-label="Operations sections" className="flex-1 px-3 py-4">
          <ul className="space-y-0.5">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      [
                        'flex min-h-11 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-150',
                        isActive
                          ? 'bg-white text-[var(--color-ink)]'
                          : 'text-white/60 hover:bg-white/8 hover:text-white',
                      ].join(' ')
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" stroke={1.6} />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <div className="mb-3 flex items-center gap-3 px-3 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold text-white uppercase">
              {(user?.name ?? user?.mobile ?? '?').slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-white">
                {user?.name ?? user?.mobile ?? '—'}
              </div>
              <div className="truncate text-[10px] capitalize text-white/40">{roleLabel}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-white/60 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-ink)]"
          >
            <IconLogout className="h-4 w-4" stroke={1.6} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 border-b border-[var(--color-border-faint)] bg-[var(--color-canvas)]/95 backdrop-blur-xl lg:hidden">
          <div className="flex min-h-16 items-center gap-3 px-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--color-ink)] text-white">
              <IconBuildingCommunity className="h-5 w-5" stroke={1.7} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
                CIP Karnataka
              </div>
              <div className="truncate text-[11px] text-[var(--color-text-tertiary)]">
                Operations
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[#e9e7e2] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
              aria-label="Sign out"
            >
              <IconLogout className="h-5 w-5" stroke={1.6} />
            </button>
          </div>
        </header>

        {/* Department switcher bar */}
        <div className="border-b border-[var(--color-border-faint)] bg-[#faf9f6] px-4 py-2 lg:px-10">
          <DepartmentSwitcher />
        </div>

        {/* Content area */}
        <main className="w-full flex-1 px-4 py-6 pb-28 sm:px-6 lg:px-10 lg:py-8 lg:pb-12">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav
          aria-label="Operations sections"
          className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-black/10 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_12px_40px_rgba(29,29,27,0.16)] backdrop-blur-xl lg:hidden"
        >
          <ul className="grid grid-cols-5 items-stretch px-1">
            {MOBILE_NAV.filter(
              (item) => item.allowedRoles === undefined || hasAnyRole(item.allowedRoles),
            ).map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      [
                        'relative flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors',
                        isActive ? 'text-[var(--color-ink)]' : 'text-[var(--color-text-tertiary)]',
                      ].join(' ')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className="h-5 w-5" stroke={isActive ? 2.1 : 1.6} />
                        <span className="max-w-full truncate leading-tight">{item.label}</span>
                        {isActive && (
                          <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--color-ink)]" />
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
