import { useState, type FormEvent, type JSX } from 'react';
import {
  useAdminReportTypes,
  useCreateReportType,
  useUpdateReportType,
  useDeleteReportType,
  type AdminReportType,
  type AdminReportTypeInput,
} from '../api/client';
import {
  Spinner,
  EmptyState,
  ErrorState,
  Dialog,
  Button,
  Card,
  CardBody,
  Badge,
} from '../../moderator/design';
import { IconPlus, IconPencil, IconTrash, IconPhoto, IconVideo } from '@tabler/icons-react';

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

function ReportTypeForm({
  initial,
  onSubmit,
  onCancel,
  busy,
}: {
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
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-[#1d1d1b]">
            Name <span className="text-[#9f3731]">*</span>
          </span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            required
            className="mt-1 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[#1d1d1b]">
            Code <span className="text-[#9f3731]">*</span>
          </span>
          <input
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            required
            placeholder="roads"
            className="mt-1 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 font-mono text-base focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-[#1d1d1b]">Description</span>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={2}
          className="mt-1 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-[#1d1d1b]">Icon</span>
          <input
            value={draft.icon}
            onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
            placeholder="🕳️"
            className="mt-1 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[#1d1d1b]">Color</span>
          <input
            value={draft.color}
            onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            placeholder="#f59e0b"
            className="mt-1 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[#1d1d1b]">Min photos</span>
          <input
            type="number"
            min={0}
            value={draft.min_photos}
            onChange={(e) => setDraft({ ...draft, min_photos: num(e.target.value) })}
            className="mt-1 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[#1d1d1b]">Max photos</span>
          <input
            type="number"
            min={0}
            value={draft.max_photos}
            onChange={(e) => setDraft({ ...draft, max_photos: num(e.target.value) })}
            className="mt-1 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.requires_photo}
            onChange={(e) => setDraft({ ...draft, requires_photo: e.target.checked })}
            className="h-4 w-4 rounded border-[#d0cec8] text-[#1d1d1b] focus:ring-[#1d1d1b]"
          />
          <span className="font-medium text-[#1d1d1b]">Requires photo</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.requires_video}
            onChange={(e) => setDraft({ ...draft, requires_video: e.target.checked })}
            className="h-4 w-4 rounded border-[#d0cec8] text-[#1d1d1b] focus:ring-[#1d1d1b]"
          />
          <span className="font-medium text-[#1d1d1b]">Requires video</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            className="h-4 w-4 rounded border-[#d0cec8] text-[#1d1d1b] focus:ring-[#1d1d1b]"
          />
          <span className="font-medium text-[#1d1d1b]">Active</span>
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save type'}
        </Button>
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
    <div className="min-h-screen bg-[#f3f2ed] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#1d1d1b]">
              Report types
            </h1>
            <p className="mt-1 text-sm text-[#6f6e69]">
              Categories citizens can pick. Code is the stable identifier.
            </p>
          </div>
          <Button onClick={openNew} leftIcon={<IconPlus className="h-4 w-4" stroke={1.8} />}>
            New type
          </Button>
        </header>

        {types.isLoading ? (
          <div className="flex justify-center py-12" aria-live="polite">
            <Spinner label="Loading report types" />
          </div>
        ) : types.isError ? (
          <ErrorState title="Failed to load report types" error={types.error} />
        ) : (types.data ?? []).length === 0 ? (
          <EmptyState
            title="No report types"
            description="Add at least one — the citizen PWA shows the list at submit time."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(types.data ?? []).map((t: AdminReportType) => (
              <Card key={t.id}>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[#1d1d1b]">{t.name}</h2>
                    <span className="rounded bg-[#efeee9] px-1.5 py-0.5 font-mono text-[10px] text-[#6f6e69]">
                      {t.code}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.requires_photo && (
                      <Badge tone="danger" className="bg-[#fbeeed] text-[#9f3731] ring-transparent">
                        <IconPhoto className="h-3 w-3" stroke={1.6} />
                        photo required
                      </Badge>
                    )}
                    {t.requires_video && (
                      <Badge tone="purple" className="bg-[#f3eef6] text-[#6b4593] ring-transparent">
                        <IconVideo className="h-3 w-3" stroke={1.6} />
                        video required
                      </Badge>
                    )}
                    {!t.active ? (
                      <Badge
                        tone="warning"
                        className="bg-[#fff6e4] text-[#805913] ring-transparent"
                      >
                        inactive
                      </Badge>
                    ) : (
                      <Badge
                        tone="success"
                        className="bg-[#edf7f0] text-[#256b45] ring-transparent"
                      >
                        active
                      </Badge>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-[#6f6e69]">
                    {t.min_photos}–{t.max_photos} photos · {t.description ?? 'no description'}
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<IconPencil className="h-3.5 w-3.5" stroke={1.6} />}
                      onClick={() => openEdit(t)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      leftIcon={<IconTrash className="h-3.5 w-3.5" stroke={1.6} />}
                      onClick={() => onDelete(t)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={editing ? `Edit: ${editing.name}` : 'New report type'}
        >
          <ReportTypeForm
            initial={toDraft(editing)}
            onSubmit={onSubmit}
            onCancel={() => setDialogOpen(false)}
            busy={busy}
          />
          {create.isError ? (
            <p role="alert" className="mt-2 text-sm text-[#9f3731]">
              {create.error?.message}
            </p>
          ) : null}
          {update.isError ? (
            <p role="alert" className="mt-2 text-sm text-[#9f3731]">
              {update.error?.message}
            </p>
          ) : null}
        </Dialog>
      </div>
    </div>
  );
}
