import { useEffect, useState, type FormEvent, type JSX } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  IconAlertTriangle,
  IconBell,
  IconBuilding,
  IconChevronRight,
  IconClipboardList,
  IconHistory,
  IconLayoutDashboard,
  IconShield,
  IconUser,
} from '@tabler/icons-react';
import { apiRequest, type ApiEnvelope } from '../../auth/api';
import { useAuth } from '../../auth/AuthContext';
import { pushSupport, subscribeToPush } from '../../portals/citizen/push/subscribe';
// Shared page, operations-specific overflow: the DR_LINEN destinations dropped
// from the mobile bottom bar live here, so this page reads the operations
// offline queue to badge the Reupload row (same source as the
// operations OfflineBanner). Other portals never render that section.
import { useOpsQueue } from '../../portals/operations/offline/useOpsQueue';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  Spinner,
} from '../ui';

/**
 * Shared staff profile page for the moderator and operations (department
 * officer) portals.
 *
 * Staff can keep their display name and login mobile current through the
 * same role-agnostic `PATCH /auth/profile` endpoint the citizen portal
 * uses (the mobile is normalised and uniqueness-checked server-side).
 * Everything else — email, preferred name, access roles, department
 * memberships, account dates — is organisation-managed and shown
 * read-only, so the page exposes no other editable settings.
 *
 * Loading, empty, and error states are explicit so the page never renders
 * a blank screen while the identity fetch is in flight or fails.
 */

export interface StaffProfileDepartment {
  id: string;
  code: string;
  name: string;
  is_manager: boolean;
}

export interface StaffProfileData {
  id: string;
  name: string | null;
  preferred_name: string | null;
  mobile: string | null;
  email: string | null;
  status: string | null;
  last_login_at: string | null;
  created_at: string | null;
  roles?: string[];
  departments?: StaffProfileDepartment[];
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function humanizeRole(role: string): string {
  return role
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-xs font-medium text-[var(--color-ink)]">
        {value ?? '—'}
      </dd>
    </div>
  );
}

/**
 * Destinations removed from the operations mobile bottom bar (kept to max 5
 * items) that stay reachable for DR_LINEN staff from the Profile page.
 * Icons and labels mirror the operations `DR_LINEN_NAV` entries.
 */
const TEXTILE_MORE_LINKS = [
  { to: '/operations/textile-collections/completed', label: 'History', icon: IconHistory },
  {
    to: '/operations/textile-collections/reuploads',
    label: 'Reupload',
    icon: IconShield,
    badge: 'pending-uploads' as const,
  },
  {
    to: '/operations/textile-collections/offline-recovery',
    label: 'Server failures',
    icon: IconAlertTriangle,
  },
  {
    to: '/operations/textile-collections/capacity',
    label: 'Dashboard',
    icon: IconLayoutDashboard,
  },
];

/**
 * Overflow destinations removed from the operations mobile bottom bar.
 * Isolated so the offline-queue subscription only runs when the section is
 * shown (operations portal, DR_LINEN staff) — never for moderator/admin.
 */
function TextileCollectionsMoreLinks(): JSX.Element {
  const { pending } = useOpsQueue();
  const pendingCount = pending.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <IconClipboardList className="h-4 w-4 text-[var(--color-text-secondary)]" stroke={1.6} />
          <CardTitle>Textile collections</CardTitle>
        </div>
      </CardHeader>
      <CardBody>
        <ul className="divide-y divide-[var(--color-border-subtle)]">
          {TEXTILE_MORE_LINKS.map((link) => {
            const LinkIcon = link.icon;
            const showPendingBadge = link.badge === 'pending-uploads' && pendingCount > 0;
            return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="flex h-10 items-center gap-2.5 rounded-lg px-2 text-xs font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
                >
                  <LinkIcon
                    className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]"
                    stroke={1.6}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{link.label}</span>
                  {showPendingBadge ? <Badge tone="warning">{pendingCount} pending</Badge> : null}
                  <IconChevronRight
                    className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]"
                    stroke={1.6}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

export default function StaffProfilePage(): JSX.Element {
  const queryClient = useQueryClient();
  const { updateUser, user } = useAuth();
  const { pathname } = useLocation();
  const queryKey = ['staff-profile', 'me'];

  const {
    data: envelope,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => apiRequest<ApiEnvelope<StaffProfileData>>('/auth/me'),
  });

  const profile = envelope?.data;

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? '');
    setMobile(profile.mobile ?? '');
  }, [profile]);

  async function saveProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const response = await apiRequest<ApiEnvelope<StaffProfileData>>('/auth/profile', {
        method: 'PATCH',
        body: {
          name: name.trim(),
          mobile: mobile.trim(),
        },
      });
      queryClient.setQueryData(queryKey, response);
      updateUser({ name: response.data.name, mobile: response.data.mobile });
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }

  async function enableTrustedDevice(): Promise<void> {
    setEnablingPush(true);
    setPushMessage(null);
    const result = await subscribeToPush();
    setPushMessage(
      result.ok
        ? 'This device can now approve future sign-ins.'
        : (result.detail ?? 'Push notifications could not be enabled on this device.'),
    );
    setEnablingPush(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24" aria-live="polite">
        <Spinner label="Loading profile" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load profile"
        description="Your profile could not be loaded. Try again, or sign out and back in."
        action={
          <Button variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        }
        error={error}
      />
    );
  }

  if (!profile) {
    return (
      <EmptyState
        title="No profile data"
        description="Your account returned no profile information. Contact your administrator if this persists."
      />
    );
  }

  const canSave = name.trim().length > 0 && mobile.trim().length > 0;
  const roles = profile.roles ?? [];
  const departments = profile.departments ?? [];
  // Overflow links for destinations dropped from the mobile bottom bar. Shown
  // only inside the operations portal for DR_LINEN staff; the shared page is
  // also used by the moderator and admin portals.
  const showTextileMoreLinks =
    pathname.startsWith('/operations') &&
    (user?.departments?.some((department) => department.code === 'DR_LINEN') ?? false);

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Staff account
          </p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-[var(--color-ink)]">
            Profile
          </h1>
          <p className="mt-0.5 max-w-2xl text-xs text-[var(--color-text-secondary)]">
            Your identity, department memberships, and account details.
          </p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)]">
          <IconUser className="h-4 w-4 text-[var(--color-text-secondary)]" stroke={1.6} />
        </span>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconUser className="h-4 w-4 text-[var(--color-text-secondary)]" stroke={1.6} />
              <CardTitle>Profile details</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            <form onSubmit={(event) => void saveProfile(event)} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  id="staff-profile-name"
                  label="Name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  maxLength={255}
                  placeholder="Your display name"
                />
                <Input
                  id="staff-profile-mobile"
                  label="Mobile number"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={15}
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  placeholder="10-digit mobile number"
                  hint="Used to sign in to the platform."
                />
              </div>
              {saveError ? (
                <p role="alert" className="text-xs font-medium text-[var(--color-danger)]">
                  {saveError}
                </p>
              ) : null}
              {saved ? (
                <p role="status" className="text-xs font-medium text-emerald-700">
                  Profile updated.
                </p>
              ) : null}
              <Button
                type="submit"
                size="sm"
                disabled={saving || !canSave}
                className="w-full justify-center sm:w-auto"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconBell className="h-4 w-4 text-[var(--color-text-secondary)]" stroke={1.6} />
              <CardTitle>Trusted device</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            <p className="max-w-2xl text-xs leading-5 text-[var(--color-text-secondary)]">
              Enable notifications on this signed-in device to approve future sign-ins without
              replacing your OTP or password fallback.
            </p>
            {pushMessage ? (
              <p role="status" className="mt-2 text-xs font-medium text-emerald-700">
                {pushMessage}
              </p>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="mt-3 w-full justify-center sm:w-auto"
              disabled={enablingPush || !pushSupport().supported}
              onClick={() => void enableTrustedDevice()}
            >
              {enablingPush ? 'Enabling…' : 'Enable sign-in approvals'}
            </Button>
            {!pushSupport().supported ? (
              <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                Push notifications are not available in this browser.
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconUser className="h-4 w-4 text-[var(--color-text-secondary)]" stroke={1.6} />
              <CardTitle>Identity</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            <dl className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Email" value={profile.email} />
              <InfoRow label="Preferred name" value={profile.preferred_name} />
              <InfoRow label="Account status" value={humanizeRole(profile.status ?? '')} />
            </dl>
            {roles.length > 0 && (
              <div className="mt-4 border-t border-[var(--color-border-subtle)] pt-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  Access roles
                </dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {roles.map((role) => (
                    <Badge key={role} tone="neutral" className="capitalize">
                      {humanizeRole(role)}
                    </Badge>
                  ))}
                </dd>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconBuilding className="h-4 w-4 text-[var(--color-text-secondary)]" stroke={1.6} />
              <CardTitle>Departments</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            {departments.length === 0 ? (
              <p className="text-xs text-[var(--color-text-tertiary)]">
                No department memberships.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {departments.map((department) => (
                  <li
                    key={department.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)]/50 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[var(--color-ink)]">
                        {department.name}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                        {department.code}
                      </p>
                    </div>
                    {department.is_manager && <Badge tone="info">Manager</Badge>}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 border-t border-[var(--color-border-subtle)] pt-3">
              <dl className="grid gap-3 sm:grid-cols-2">
                <InfoRow label="Member since" value={formatDate(profile.created_at)} />
                <InfoRow label="Last login" value={formatDate(profile.last_login_at)} />
              </dl>
            </div>
          </CardBody>
        </Card>
      </div>

      {showTextileMoreLinks ? (
        <div className="lg:hidden">
          <TextileCollectionsMoreLinks />
        </div>
      ) : null}
    </div>
  );
}
