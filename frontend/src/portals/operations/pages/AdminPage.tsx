import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Spinner,
  EmptyState,
  Input,
  Select,
  Button,
  Badge,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '../design';
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
    queryFn: async () => (await adminApi.listDepartments()).data,
    enabled: canChooseDepartment,
  });
  const selectableDepartments = departmentsQuery.data ?? [];
  const department = canChooseDepartment
    ? selectableDepartments.find((item) => item.id === selectedDepartmentId) ?? selectableDepartments[0] ?? null
    : user?.departments?.[0] ?? null;
  const departmentId = department?.id ?? '';

  const { data: officers, isLoading, refetch } = useQuery<DepartmentOfficer[]>({
    queryKey: ['admin', 'officers', departmentId],
    queryFn: async () => (await adminApi.listOfficers(departmentId)).data,
    enabled: Boolean(departmentId),
  });

  const [sla, setSla] = useState<string>('240');
  const [workingHours, setWorkingHours] = useState<Array<{ day: Day; open: string; close: string }>>([
    { day: 'mon', open: '09:00', close: '17:00' },
  ]);
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
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Department admin</h1>
          <p className="text-sm text-slate-500">No department is assigned to this account.</p>
        </header>
        <Card>
          <CardBody>
            <p className="text-sm text-slate-700">
              Ask a platform administrator to assign this user to a department before managing officers or settings.
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

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Department admin</h1>
          <p className="text-sm text-slate-500">{department?.name}</p>
        </div>
        {canChooseDepartment ? (
          <div className="w-72">
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
          <CardTitle>Officers</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              label="User id (UUID)"
              value={newOfficerId}
              onChange={(e) => setNewOfficerId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
            <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={newIsManager}
                onChange={(e) => setNewIsManager(e.target.checked)}
              />
              Is manager
            </label>
            <div className="flex items-end">
              <Button
                variant="primary"
                onClick={() => { attachOfficer.mutate(); }}
                disabled={attachOfficer.isPending || newOfficerId.trim() === ''}
              >
                {attachOfficer.isPending ? 'Attaching…' : 'Attach officer'}
              </Button>
            </div>
          </div>

          {(!officers || officers.length === 0) ? (
            <EmptyState title="No officers attached" description="Attach one above." />
          ) : (
            <Table>
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
                    <TD>{o.name ?? '—'}</TD>
                    <TD className="font-mono text-xs">{o.mobile}</TD>
                    <TD>{o.email ?? '—'}</TD>
                    <TD>{o.is_manager ? <Badge tone="info">Manager</Badge> : <Badge>Officer</Badge>}</TD>
                    <TD className="text-xs text-slate-500">
                      {o.assigned_at ? new Date(o.assigned_at).toLocaleDateString() : '—'}
                    </TD>
                    <TD>
                      <Button
                        variant="danger"
                        onClick={() => { detachOfficer.mutate(o.id); }}
                        disabled={detachOfficer.isPending}
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
        <CardBody className="space-y-3">
          <Input
            label="Default SLA (minutes)"
            type="number"
            value={sla}
            onChange={(e) => setSla(e.target.value)}
          />
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Working hours</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-slate-500">
                  <th className="text-left">Day</th>
                  <th className="text-left">Open</th>
                  <th className="text-left">Close</th>
                </tr>
              </thead>
              <tbody>
                {workingHours.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <select
                        value={row.day}
                        onChange={(e) => {
                          const v = e.target.value as Day;
                          setWorkingHours((cur) => cur.map((r, i) => (i === idx ? { ...r, day: v } : r)));
                        }}
                        className="rounded border border-slate-300 px-2 py-1"
                      >
                        {DAYS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="time"
                        value={row.open}
                        onChange={(e) => setWorkingHours((cur) => cur.map((r, i) => (i === idx ? { ...r, open: e.target.value } : r)))}
                        className="rounded border border-slate-300 px-2 py-1"
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={row.close}
                        onChange={(e) => setWorkingHours((cur) => cur.map((r, i) => (i === idx ? { ...r, close: e.target.value } : r)))}
                        className="rounded border border-slate-300 px-2 py-1"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Input
            label="Holiday calendar (YYYY-MM-DD, comma-separated)"
            value={holidaysText}
            onChange={(e) => setHolidaysText(e.target.value)}
          />
          <Button
            variant="primary"
            onClick={() => { updateAdmin.mutate(); }}
            disabled={updateAdmin.isPending}
          >
            {updateAdmin.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
