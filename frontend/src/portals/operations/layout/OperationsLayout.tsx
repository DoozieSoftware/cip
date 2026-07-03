import { type ReactNode } from 'react';
import { SidebarLayout, type SidebarNavItem } from '../../moderator/design';

const NAV: SidebarNavItem[] = [
  { to: '/operations', label: 'Dashboard', end: true, icon: '📊' },
  { to: '/operations/reports', label: 'Assigned Reports', icon: '📋' },
  { to: '/operations/reports/export', label: 'Export', icon: '📤' },
  { to: '/operations/analytics', label: 'Analytics', icon: '📈' },
  { to: '/operations/map', label: 'GIS Map', icon: '🗺️' },
  { to: '/operations/audit', label: 'Audit Log', icon: '📜' },
  { to: '/operations/security', label: 'Security', icon: '🔒' },
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
  return (
    <SidebarLayout
      brand="CIP"
      brandSubtitle="Operations Portal"
      brandColor="emerald"
      accent="emerald"
      nav={NAV}
      user={{ name: 'Officer', roleLabel: 'operations' }}
      keyboardShortcuts={SHORTCUTS}
    />
  );
}
