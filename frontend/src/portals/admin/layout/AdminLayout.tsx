import { type JSX } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { SidebarLayout, type SidebarNavItem } from '../../moderator/design';

const NAV: SidebarNavItem[] = [
  { to: '/admin', label: 'Overview', end: true, icon: <Icon name="dashboard" />, group: 'Control plane' },
  { to: '/admin/organizations', label: 'Organizations', icon: <Icon name="organization" />, group: 'Directory' },
  { to: '/admin/departments', label: 'Departments', icon: <Icon name="building" />, group: 'Directory' },
  { to: '/admin/users', label: 'Users', icon: <Icon name="users" />, group: 'Directory' },
  { to: '/admin/roles', label: 'Access control', icon: <Icon name="shield" />, group: 'Directory' },
  { to: '/admin/report-types', label: 'Report types', icon: <Icon name="tag" />, group: 'Service design' },
  { to: '/admin/routing-rules', label: 'Routing rules', icon: <Icon name="route" />, group: 'Service design' },
  { to: '/admin/workflows', label: 'Workflows', icon: <Icon name="workflow" />, group: 'Service design' },
  { to: '/admin/ai', label: 'AI configuration', icon: <Icon name="cpu" />, group: 'Automation' },
  { to: '/admin/integrations', label: 'Integrations', icon: <Icon name="plug" />, group: 'Automation' },
  { to: '/admin/notifications', label: 'Notifications', icon: <Icon name="bell" />, group: 'Automation' },
  { to: '/admin/storage', label: 'Object storage', icon: <Icon name="database" />, group: 'Automation' },
  { to: '/admin/security-policies', label: 'Security policies', icon: <Icon name="lock" />, group: 'Governance' },
  { to: '/admin/feature-flags', label: 'Feature flags', icon: <Icon name="flag" />, group: 'Governance' },
  { to: '/admin/retention', label: 'Data retention', icon: <Icon name="archive" />, group: 'Governance' },
  { to: '/admin/audit', label: 'Audit log', icon: <Icon name="audit" />, group: 'Governance' },
  { to: '/admin/health', label: 'Platform health', icon: <Icon name="pulse" />, group: 'Platform' },
  { to: '/admin/scheduler', label: 'Scheduler', icon: <Icon name="clock" />, group: 'Platform' },
  { to: '/admin/system', label: 'System settings', icon: <Icon name="settings" />, group: 'Platform' },
];

export function AdminLayout() {
  const { user } = useAuth();
  return (
    <SidebarLayout
      brand="Government of Karnataka"
      brandMark="KA"
      brandSubtitle="Civic Intelligence Platform"
      brandColor="brand"
      accent="brand"
      sidebarTone="dark"
      nav={NAV}
      user={{
        name: user?.name ?? user?.mobile ?? '—',
        roleLabel: 'Super administrator',
      }}
      headerContent={<div className="flex items-center gap-3 text-xs"><span className="font-semibold text-blue-900">Super Administration</span><span className="h-4 w-px bg-slate-200" /><span className="inline-flex items-center gap-1.5 text-slate-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />System operational</span><span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 font-medium text-slate-600">LOCAL</span></div>}
    />
  );
}

type IconName = 'dashboard' | 'organization' | 'building' | 'users' | 'shield' | 'tag' | 'route' | 'workflow' | 'cpu' | 'plug' | 'bell' | 'database' | 'lock' | 'flag' | 'archive' | 'audit' | 'pulse' | 'clock' | 'settings';

function Icon({ name }: { name: IconName }): JSX.Element {
  const paths: Record<IconName, JSX.Element> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    organization: <><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-5h6v5" /></>,
    building: <><path d="M4 21V3h11v18M15 9h5v12M8 7h3M8 11h3M8 15h3" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    tag: <><path d="m20.6 13.6-7 7a2 2 0 0 1-2.8 0L3 12.8V4h8.8l8.8 8.8a1 1 0 0 1 0 .8Z" /><circle cx="7.5" cy="8.5" r="1" /></>,
    route: <><circle cx="6" cy="19" r="3" /><circle cx="18" cy="5" r="3" /><path d="M6 16V8a3 3 0 0 1 3-3h6M18 8v8a3 3 0 0 1-3 3H9" /></>,
    workflow: <><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /><path d="M9 6h3a3 3 0 0 1 3 3v6M6 9v6a3 3 0 0 0 3 3h6" /></>,
    cpu: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3M9 9h6v6H9z" /></>,
    plug: <path d="m12 22 5-5-3-3 4-4-4-4-4 4-3-3-5 5 10 10ZM14 6l3-3M18 10l3-3" />,
    bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
    database: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    flag: <path d="M5 22V4M5 4h11l-2 4 2 4H5" />,
    archive: <><path d="M3 6h18M5 6v15h14V6M9 10h6" /><rect x="2" y="3" width="20" height="3" rx="1" /></>,
    audit: <><path d="M4 3h16v18H4zM8 7h8M8 11h8M8 15h5" /></>,
    pulse: <path d="M3 12h4l2-6 4 12 2-6h6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21h-4v-.09a1.7 1.7 0 0 0-1.1-1.51 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.24.37.56.68.94.9.3.17.64.26 1 .27H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z" /></>,
  };
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
