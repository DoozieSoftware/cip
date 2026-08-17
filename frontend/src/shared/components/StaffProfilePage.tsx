import { useEffect, useState, type FormEvent, type JSX } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconBuilding, IconClock, IconUser } from '@tabler/icons-react';
import { apiRequest, type ApiEnvelope } from '../../auth/api';
import { useAuth } from '../../auth/AuthContext';
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
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-[#1d1d1b]">{value ?? '—'}</dd>
    </div>
  );
}

export default function StaffProfilePage(): JSX.Element {
  const queryClient = useQueryClient();
  const { updateUser } = useAuth();
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

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
            Staff account
          </p>
          <h1 className="mt-1 text-[1.75rem] font-medium tracking-[-0.02em] text-[var(--color-ink)]">
            Profile
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
            Your identity, department memberships, and account details.
          </p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d8d6cf] bg-[#faf9f6]">
          <IconUser className="h-5 w-5 text-[#6f6e69]" stroke={1.6} />
        </span>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconUser className="h-5 w-5 text-[#6f6e69]" stroke={1.6} />
            <CardTitle>Profile details</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={(event) => void saveProfile(event)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
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
              <p role="alert" className="text-sm text-red-700">
                {saveError}
              </p>
            ) : null}
            {saved ? (
              <p role="status" className="text-sm text-emerald-700">
                Profile updated.
              </p>
            ) : null}
            <Button type="submit" disabled={saving || !canSave}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconUser className="h-5 w-5 text-[#6f6e69]" stroke={1.6} />
              <CardTitle>Identity</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            <dl className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Email" value={profile.email} />
              <InfoRow label="Preferred name" value={profile.preferred_name} />
              <InfoRow label="Account status" value={humanizeRole(profile.status ?? '')} />
            </dl>
            {roles.length > 0 && (
              <div className="mt-5 border-t border-[#e6e4dc] pt-4">
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                  Access roles
                </dt>
                <dd className="mt-2 flex flex-wrap gap-2">
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
              <IconBuilding className="h-5 w-5 text-[#6f6e69]" stroke={1.6} />
              <CardTitle>Departments</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            {departments.length === 0 ? (
              <p className="text-sm text-[#85847f]">No department memberships.</p>
            ) : (
              <ul className="space-y-2">
                {departments.map((department) => (
                  <li
                    key={department.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-[#e6e4dc] bg-[#faf9f6] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#1d1d1b]">
                        {department.name}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                        {department.code}
                      </p>
                    </div>
                    {department.is_manager && <Badge tone="info">Manager</Badge>}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 border-t border-[#e6e4dc] pt-4">
              <dl className="grid gap-4 sm:grid-cols-2">
                <InfoRow label="Member since" value={formatDate(profile.created_at)} />
                <InfoRow label="Last login" value={formatDate(profile.last_login_at)} />
              </dl>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconClock className="h-5 w-5 text-[#6f6e69]" stroke={1.6} />
            <CardTitle>Account</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            Your email, role, and department memberships are managed by your organisation. Contact
            your administrator to update them.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
