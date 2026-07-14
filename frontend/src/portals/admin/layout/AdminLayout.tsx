import { useAuth } from '../../../auth/AuthContext';
import { SidebarLayout, type SidebarNavItem } from '../../moderator/design';

const NAV: SidebarNavItem[] = [
  { to: '/admin', label: 'Dashboard', end: true, icon: '📊' },
  { to: '/admin/organizations', label: 'Organizations', icon: '🏛️' },
  { to: '/admin/departments', label: 'Departments', icon: '🏢' },
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/roles', label: 'Roles & perms', icon: '🛡️' },
  { to: '/admin/report-types', label: 'Report types', icon: '🏷️' },
  { to: '/admin/security-policies', label: 'Security', icon: '🔒' },
  { to: '/admin/feature-flags', label: 'Feature flags', icon: '🚩' },
  { to: '/admin/health', label: 'Health', icon: '💓' },
  { to: '/admin/scheduler', label: 'Scheduler', icon: '⏱️' },
  { to: '/admin/integrations', label: 'Integrations', icon: '🔌' },
  { to: '/admin/storage', label: 'Storage', icon: '💾' },
  { to: '/admin/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/admin/ai', label: 'AI', icon: '🤖' },
  { to: '/admin/routing-rules', label: 'Routing', icon: '🧭' },
  { to: '/admin/workflows', label: 'Workflows', icon: '🔀' },
  { to: '/admin/retention', label: 'Retention', icon: '🗄️' },
  { to: '/admin/system', label: 'System', icon: '⚙️' },
  { to: '/admin/audit', label: 'Audit log', icon: '📜' },
];

export function AdminLayout() {
  const { user } = useAuth();
  return (
    <SidebarLayout
      brand="Super Admin"
      brandSubtitle="Platform configuration"
      brandColor="fuchsia"
      accent="fuchsia"
      nav={NAV}
      user={{
        name: user?.name ?? user?.mobile ?? '—',
        roleLabel: 'super_admin',
      }}
    />
  );
}
