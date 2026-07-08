import { useMemo, type ReactNode } from 'react';
import { SidebarLayout, type SidebarNavItem } from '../../moderator/design';
import { useAuth, type Role } from '../../../auth/AuthContext';

type OperationsNavItem = SidebarNavItem & {
  allowedRoles?: Role[];
};

const AUDIT_SECURITY_ROLES: Role[] = ['super_admin', 'system', 'auditor', 'department_admin'];

const NAV: OperationsNavItem[] = [
  { to: '/operations', label: 'Dashboard', end: true, icon: '📊' },
  { to: '/operations/reports', label: 'Assigned Reports', icon: '📋' },
  { to: '/operations/reports/export', label: 'Export', icon: '📤' },
  { to: '/operations/analytics', label: 'Analytics', icon: '📈' },
  { to: '/operations/map', label: 'GIS Map', icon: '🗺️' },
  { to: '/operations/audit', label: 'Audit Log', icon: '📜', allowedRoles: AUDIT_SECURITY_ROLES },
  { to: '/operations/security', label: 'Security', icon: '🔒', allowedRoles: AUDIT_SECURITY_ROLES },
  { to: '/operations/admin', label: 'Department Admin', icon: '🏢' },
];

const SHORTCUTS: ReactNode = (
  <>
    v1.0 — keyboard:{' '}
    <kbd className="rounded bg-slate-100 px-1">A</kbd> accept ·{' '}
    <kbd className="rounded bg-slate-100 px-1">S</kbd> start ·{' '}
    <kbd className="rounded bg-slate-100 px-1">R</kbd> resolve ·{' '}
    <kbd className="rounded bg-slate-100 px-1">C</kbd> close ·{' '}
    <kbd className="rounded bg-slate-100 px-1">N</kbd> note
  </>
);

export function OperationsLayout() {
  const { user, hasAnyRole } = useAuth();
  const nav = useMemo<SidebarNavItem[]>(
    () => NAV.filter((item) => item.allowedRoles === undefined || hasAnyRole(item.allowedRoles)),
    [hasAnyRole],
  );
  const roleLabel = user?.roles[0]?.replace(/_/g, ' ') ?? 'operations';

  return (
    <SidebarLayout
      brand="CIP"
      brandSubtitle="Operations Portal"
      brandColor="emerald"
      accent="emerald"
      nav={nav}
      user={{ name: user?.name, mobile: user?.mobile, roleLabel }}
      keyboardShortcuts={SHORTCUTS}
    />
  );
}
