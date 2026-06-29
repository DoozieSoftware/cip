import { useAdminReportTypes, type AdminReportType } from '../api/client';
import { type JSX } from 'react';
import { Spinner, EmptyState } from '../../moderator/design';

export default function AdminReportTypes(): JSX.Element {
  const types = useAdminReportTypes();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Report types</h1>
        <p className="text-sm text-slate-600">Categories citizens can pick. Code is the stable identifier.</p>
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
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
