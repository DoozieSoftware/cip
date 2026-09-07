import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconBuilding, IconUsers } from '@tabler/icons-react';
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
  Select,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../../../shared/ui';
import { adminApi, type AdminUpdatePayload, type AttachOfficerPayload } from '../api/operations';
import { useAuth } from '../../../auth/AuthContext';
import type { DepartmentOfficer } from '../types';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type Day = (typeof DAYS)[number];

export default function AdminPage() {
  const { user, hasAnyRole } = useAuth();
  const queryClient = useQueryClient();
  const canChooseDepartment = hasAnyRole(['super_admin', 'system']);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const departmentsQuery = useQuery({
    queryKey: ['admin', 'departments'],
    queryFn: () => adminApi.listDepartments(),
    enabled: canChooseDepartment,
  });
  const selectableDepartments = departmentsQuery.data ?? [];
  const department = canChooseDepartment
    ? (selectableDepartments.find((item) => item.id === selectedDepartmentId) ??
      selectableDepartments[0] ??
      null)
    : (user?.departments?.[0] ?? null);
  const departmentId = department?.id ?? '';

  const attachableUsersQuery = useQuery({
    queryKey: ['admin', 'attachable-users'],
    queryFn: () => adminApi.listAttachableUsers(),
    enabled: canChooseDepartment,
  });

  const {
    data: officers,
    isLoading,
    error: officersError,
    refetch,
  } = useQuery<DepartmentOfficer[]>({
    queryKey: ['admin', 'officers', departmentId],
    queryFn: async () => (await adminApi.listOfficers(departmentId)).data,
    enabled: Boolean(departmentId),
  });

  const [sla, setSla] = useState<string>('240');
  const [workingHours, setWorkingHours] = useState<
    Array<{ day: Day; open: string; close: string }>
  >([{ day: 'mon', open: '09:00', close: '17:00' }]);
  const [holidaysText, setHolidaysText] = useState<string>('2026-12-25, 2026-12-26');

  const updateAdmin = useMutation({
    mutationFn: () => {
      const payload: AdminUpdatePayload = {
        default_sla_minutes: Number(sla) > 0 ? Number(sla) : undefined,
        working_hours: workingHours.length > 0 ? workingHours : undefined,
        holiday_calendar: holidaysText
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s !== ''),
      };
      return adminApi.updateAdmin(departmentId, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  const [newOfficerId, setNewOfficerId] = useState('');
  const [newIsManager, setNewIsManager] = useState(false);
  const attachOfficer = useMutation({
    mutationFn: () => {
      const payload: AttachOfficerPayload = {
        user_id: newOfficerId,
        is_manager: newIsManager,
      };
      return adminApi.attachOfficer(departmentId, payload);
    },
    onSuccess: () => {
      setNewOfficerId('');
      setNewIsManager(false);
      void refetch();
    },
  });

  const detachOfficer = useMutation({
    mutationFn: (userId: string) => adminApi.detachOfficer(departmentId, userId),
    onSuccess: () => {
      void refetch();
    },
  });

  if (canChooseDepartment && departmentsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading departments" />
      </div>
    );
  }

  if (!departmentId) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-ink)]">
            <IconBuilding className="h-5 w-5 text-white" stroke={1.6} />
          </div>
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
              Administration
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">
              Department admin
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)]">
              No department is assigned to this account.
            </p>
          </div>
        </header>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Ask a platform administrator to assign this user to a department before managing
              officers or settings.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading admin" />
      </div>
    );
  }

  if (officersError) {
    return (
      <ErrorState
        title="Could not load officers"
        description="The department officers endpoint did not respond."
        error={officersError instanceof Error ? officersError : null}
        action={
          <Button variant="primary" onClick={() => void refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-ink)]">
            <IconBuilding className="h-5 w-5 text-white" stroke={1.6} />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
              Administration
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">
              Department admin
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)]">{department?.name}</p>
          </div>
        </div>
        {canChooseDepartment ? (
          <div className="w-full sm:w-72">
            <Select
              label="Department"
              value={departmentId}
              options={selectableDepartments.map((item) => ({
                value: item.id,
                label: `${item.name} (${item.code})`,
              }))}
              onChange={(event) => setSelectedDepartmentId(event.target.value)}
            />
          </div>
        ) : (
          <Badge tone="info">{department?.code}</Badge>
        )}
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconUsers className="h-4 w-4 text-[var(--color-text-tertiary)]" stroke={1.6} />
            <CardTitle>Officers</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {canChooseDepartment ? (
              <Select
                label="Officer"
                name="officer_id"
                value={newOfficerId}
                onChange={(e) => setNewOfficerId(e.target.value)}
                disabled={attachableUsersQuery.isLoading}
                options={[
                  {
                    value: '',
                    label: attachableUsersQuery.isLoading
                      ? 'Loading officers…'
                      : 'Select an officer',
                  },
                  ...(attachableUsersQuery.data ?? []).map((candidate) => ({
                    value: candidate.id,
                    label: `${candidate.name ?? 'Unnamed user'} (${candidate.mobile})`,
                  })),
                ]}
              />
            ) : (
              <Input
                label="Officer user id"
                value={newOfficerId}
                onChange={(e) => setNewOfficerId(e.target.value)}
                placeholder="Enter an officer account id"
              />
            )}
            <label className="flex items-center gap-2 pt-6 text-sm text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={newIsManager}
                onChange={(e) => setNewIsManager(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-ink)] focus:ring-[var(--color-ink)]"
              />
              Is manager
            </label>
            <div className="flex items-end">
              <Button
                variant="primary"
                onClick={() => {
                  attachOfficer.mutate();
                }}
                disabled={attachOfficer.isPending || newOfficerId.trim() === ''}
                className="min-h-11 rounded-full px-5"
              >
                {attachOfficer.isPending ? 'Attaching…' : 'Attach officer'}
              </Button>
            </div>
          </div>

          {!officers || officers.length === 0 ? (
            <EmptyState title="No officers attached" description="Attach one above." />
          ) : (
            /* Six columns (incl. email and a Detach button) never fit a phone;
               scroll the table instead of clipping it inside the card. */
            <Table className="overflow-x-auto">
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Mobile</TH>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  <TH>Assigned</TH>
                  <TH> </TH>
                </TR>
              </THead>
              <TBody>
                {officers.map((o) => (
                  <TR key={o.id}>
                    <TD className="text-[var(--color-ink)]">{o.name ?? '—'}</TD>
                    <TD className="font-mono text-xs text-[var(--color-ink)]">{o.mobile}</TD>
                    <TD className="text-[var(--color-ink)]">{o.email ?? '—'}</TD>
                    <TD>
                      {o.is_manager ? <Badge tone="info">Manager</Badge> : <Badge>Officer</Badge>}
                    </TD>
                    <TD className="text-xs text-[var(--color-text-secondary)]">
                      {o.assigned_at ? new Date(o.assigned_at).toLocaleDateString() : '—'}
                    </TD>
                    <TD>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          detachOfficer.mutate(o.id);
                        }}
                        disabled={detachOfficer.isPending}
                        className="min-h-9 rounded-full focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-2"
                      >
                        Detach
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <Input
            label="Response target (minutes)"
            type="number"
            value={sla}
            onChange={(e) => setSla(e.target.value)}
          />
          <div>
            <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
              Working hours
            </p>
            {/* A day select plus two time inputs per row cannot fit a phone
                width; scroll the table rather than letting it push the page. */}
            <div className="overflow-x-auto rounded-lg border border-[var(--color-border-subtle)]">
              <table className="w-full min-w-[20rem] text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-canvas)] text-xs uppercase text-[var(--color-text-secondary)]">
                    <th className="px-3 py-2 text-left font-mono text-[10px] font-medium tracking-[0.12em]">
                      Day
                    </th>
                    <th className="px-3 py-2 text-left font-mono text-[10px] font-medium tracking-[0.12em]">
                      Open
                    </th>
                    <th className="px-3 py-2 text-left font-mono text-[10px] font-medium tracking-[0.12em]">
                      Close
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {workingHours.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1.5">
                        <select
                          value={row.day}
                          onChange={(e) => {
                            const v = e.target.value as Day;
                            setWorkingHours((cur) =>
                              cur.map((r, i) => (i === idx ? { ...r, day: v } : r)),
                            );
                          }}
                          className="rounded-md border border-[var(--color-border)] bg-white px-2 py-1.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ink)]/20"
                        >
                          {DAYS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="time"
                          value={row.open}
                          onChange={(e) =>
                            setWorkingHours((cur) =>
                              cur.map((r, i) => (i === idx ? { ...r, open: e.target.value } : r)),
                            )
                          }
                          className="rounded-md border border-[var(--color-border)] bg-white px-2 py-1.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ink)]/20"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="time"
                          value={row.close}
                          onChange={(e) =>
                            setWorkingHours((cur) =>
                              cur.map((r, i) => (i === idx ? { ...r, close: e.target.value } : r)),
                            )
                          }
                          className="rounded-md border border-[var(--color-border)] bg-white px-2 py-1.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ink)]/20"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Input
            label="Holiday calendar (YYYY-MM-DD, comma-separated)"
            value={holidaysText}
            onChange={(e) => setHolidaysText(e.target.value)}
          />
          <Button
            variant="primary"
            onClick={() => {
              updateAdmin.mutate();
            }}
            disabled={updateAdmin.isPending}
            className="min-h-11 rounded-full px-5"
          >
            {updateAdmin.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
