import { useState, type FormEvent, type JSX } from 'react';
import {
  useAdminReportTypes,
  useCreateReportType,
  useUpdateReportType,
  useDeleteReportType,
  type AdminReportType,
  type AdminReportTypeInput,
} from '../api/client';
import { Spinner, EmptyState, Dialog, Button } from '../../moderator/design';

interface TypeDraft {
  id?: string;
  name: string;
  code: string;
  description: string;
  icon: string;
  color: string;
  requires_video: boolean;
  requires_photo: boolean;
  min_photos: number;
  max_photos: number;
  active: boolean;
}

const blank: TypeDraft = {
  name: '',
  code: '',
  description: '',
  icon: '',
  color: '',
  requires_video: false,
  requires_photo: false,
  min_photos: 1,
  max_photos: 5,
  active: true,
};

function ReportTypeForm({ initial, onSubmit, onCancel, busy }: {
  initial: TypeDraft;
  onSubmit: (v: AdminReportTypeInput & { id?: string }) => void;
  onCancel: () => void;
  busy: boolean;
}): JSX.Element {
  const [draft, setDraft] = useState<TypeDraft>(initial);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const payload: AdminReportTypeInput & { id?: string } = {
      name: draft.name,
      code: draft.code,
      description: draft.description || null,
      icon: draft.icon || null,
      color: draft.color || null,
      requires_video: draft.requires_video,
      requires_photo: draft.requires_photo,
      min_photos: Number(draft.min_photos),
      max_photos: Number(draft.max_photos),
      active: draft.active,
    };
    if (initial.id) payload.id = initial.id;
    onSubmit(payload);
  };

  const num = (v: string): number => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Name <span className="text-rose-600">*</span></span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Code <span className="text-rose-600">*</span></span>
          <input
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            required
            placeholder="pothole"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono text-sm"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Description</span>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={2}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Icon</span>
          <input
            value={draft.icon}
            onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
            placeholder="🕳️"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Color</span>
          <input
            value={draft.color}
            onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            placeholder="#f59e0b"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Min photos</span>
          <input
            type="number"
            min={0}
            value={draft.min_photos}
            onChange={(e) => setDraft({ ...draft, min_photos: num(e.target.value) })}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Max photos</span>
          <input
            type="number"
            min={0}
            value={draft.max_photos}
            onChange={(e) => setDraft({ ...draft, max_photos: num(e.target.value) })}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={draft.requires_photo} onChange={(e) => setDraft({ ...draft, requires_photo: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
          <span className="font-medium text-slate-700">Requires photo</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={draft.requires_video} onChange={(e) => setDraft({ ...draft, requires_video: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
          <span className="font-medium text-slate-700">Requires video</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
          <span className="font-medium text-slate-700">Active</span>
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save type'}</Button>
      </div>
    </form>
  );
}

export default function AdminReportTypes(): JSX.Element {
  const types = useAdminReportTypes();
  const create = useCreateReportType();
  const update = useUpdateReportType();
  const remove = useDeleteReportType();

  const [editing, setEditing] = useState<AdminReportType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openNew = (): void => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (t: AdminReportType): void => {
    setEditing(t);
    setDialogOpen(true);
  };

  const toDraft = (t: AdminReportType | null): TypeDraft =>
    t
      ? {
          id: t.id,
          name: t.name,
          code: t.code,
          description: t.description ?? '',
          icon: t.icon ?? '',
          color: t.color ?? '',
          requires_video: t.requires_video,
          requires_photo: t.requires_photo,
          min_photos: t.min_photos,
          max_photos: t.max_photos,
          active: t.active,
        }
      : blank;

  const onSubmit = (v: AdminReportTypeInput & { id?: string }): void => {
    const done = (): void => setDialogOpen(false);
    if (v.id) {
      const { id, ...patch } = v;
      update.mutate({ id, ...patch }, { onSuccess: done });
    } else {
      create.mutate(v, { onSuccess: done });
    }
  };

  const onDelete = (t: AdminReportType): void => {
    if (window.confirm(`Delete report type "${t.name}"? This cannot be undone.`)) {
      remove.mutate(t.id);
    }
  };

  const busy = create.isPending || update.isPending;

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Report types</h1>
          <p className="text-sm text-slate-600">Categories citizens can pick. Code is the stable identifier.</p>
        </div>
        <Button onClick={openNew}>+ New type</Button>
      </header>

      {types.isLoading ? (
        <Spinner label="Loading report types" />
      ) : (types.data ?? []).length === 0 ? (
        <EmptyState title="No report types" description="Add at least one — the citizen PWA shows the list at submit time." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(types.data ?? []).map((t: AdminReportType) => (
            <article key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">{t.name}</h2>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">{t.code}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-xs">
                {t.requires_photo && <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-800">photo required</span>}
                {t.requires_video && <span className="rounded bg-indigo-100 px-2 py-0.5 text-indigo-800">video required</span>}
                {!t.active && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">inactive</span>}
                {t.active && <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">active</span>}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {t.min_photos}–{t.max_photos} photos · {t.description ?? 'no description'}
              </p>
              <div className="mt-3 flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>Edit</Button>
                <Button variant="danger" size="sm" onClick={() => onDelete(t)}>Delete</Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? `Edit: ${editing.name}` : 'New report type'}>
        <ReportTypeForm
          initial={toDraft(editing)}
          onSubmit={onSubmit}
          onCancel={() => setDialogOpen(false)}
          busy={busy}
        />
        {create.isError ? (
          <p role="alert" className="mt-2 text-sm text-rose-700">{create.error?.message}</p>
        ) : null}
        {update.isError ? (
          <p role="alert" className="mt-2 text-sm text-rose-700">{update.error?.message}</p>
        ) : null}
      </Dialog>
    </div>
  );
}
