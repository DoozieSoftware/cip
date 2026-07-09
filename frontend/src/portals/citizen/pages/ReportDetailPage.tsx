import { Link, useParams } from 'react-router-dom';
import { type JSX, useState } from 'react';
import { useReportDetail, useReportTimeline } from '../api/client';
import { EmptyState, Spinner } from '../../moderator/design';
import { StatusBadge } from '../components/StatusBadge';
import LocationMap from '../components/LocationMap';

type Tab = 'timeline' | 'details';

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString();
}

export default function ReportDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const detail = useReportDetail(id);
  const timeline = useReportTimeline(id);
  const [tab, setTab] = useState<Tab>('timeline');

  if (detail.isLoading) return <Spinner label="Loading report" />;
  if (detail.error || !detail.data) {
    const msg = detail.error instanceof Error ? detail.error.message : "Maybe it was deleted or you don't have access.";
    return (
      <EmptyState
        title="Couldn't load this report"
        description={msg}
        action={
          <Link to="/citizen" className="mt-2 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white">
            Back to home
          </Link>
        }
      />
    );
  }

  const r = detail.data;
  const leadMedia = r.media[0];

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/citizen/reports"
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-xl text-blue-700 hover:bg-slate-50"
            aria-label="Back to reports"
          >
            ‹
          </Link>
          <div className="text-center">
            <h1 className="text-lg font-bold text-slate-950">Report details</h1>
            <p className="text-xs text-slate-500">Track report</p>
          </div>
          <span aria-hidden className="h-9 w-9" />
        </div>

        <div className="mt-4 flex gap-3">
          <div className="grid h-20 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-2xl text-slate-400">
            {leadMedia?.signed_url || leadMedia?.url ? (
              <img src={leadMedia.signed_url ?? leadMedia.url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden>□</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-slate-950">{r.title}</h2>
            <p className="mt-0.5 text-xs font-semibold text-blue-700">#{r.id.slice(0, 8).toUpperCase()}</p>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{r.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={r.status} />
              {r.is_verified ? (
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                  Verified
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {r.type?.name ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{r.type.name}</span> : null}
          {r.priority?.name ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{r.priority.name}</span>
          ) : null}
          {r.assigned_department ? (
            <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-cyan-800">
              Assigned to {r.assigned_department.name}
            </span>
          ) : null}
        </div>
      </header>

      {r.ai_summary ? (
        <section className="rounded-lg border border-cyan-200 bg-cyan-50/60 p-4">
          <h2 className="text-sm font-semibold text-cyan-950">AI insights</h2>
          {r.ai_summary.labels && r.ai_summary.labels.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.ai_summary.labels.map((l) => (
                <span key={l.name} className="rounded-full bg-white px-2 py-0.5 text-xs text-cyan-800 ring-1 ring-cyan-200">
                  {l.name} · {Math.round(l.confidence * 100)}%
                </span>
              ))}
            </div>
          ) : null}
          {r.ai_summary.recommended_department ? (
            <p className="mt-2 text-xs text-cyan-950">
              Suggested department: <strong>{r.ai_summary.recommended_department.name}</strong>
            </p>
          ) : null}
          {typeof r.ai_summary.fraud_score === 'number' ? (
            <p className="mt-1 text-xs text-cyan-950">
              Evidence review score: <strong>{Math.round(r.ai_summary.fraud_score * 100)}%</strong>
            </p>
          ) : null}
          <p className="mt-3 rounded-md border border-cyan-200 bg-white px-3 py-2 text-xs text-cyan-950">
            AI insights are informational only. A moderator or department officer reviews the report.
          </p>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-2 border-b border-slate-200 text-center text-sm font-semibold">
          <button
            type="button"
            onClick={() => setTab('timeline')}
            className={`border-b-2 pb-2 ${tab === 'timeline' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}
          >
            Timeline
          </button>
          <button
            type="button"
            onClick={() => setTab('details')}
            className={`border-b-2 pb-2 ${tab === 'details' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}
          >
            Details
          </button>
        </div>

        {tab === 'timeline' ? (
          timeline.isLoading ? (
            <div className="py-8">
              <Spinner label="Loading timeline" />
            </div>
          ) : (
            <ol className="mt-4 space-y-5 border-l-2 border-slate-200 pl-5">
              {(timeline.data ?? []).map((t, i) => (
                <li key={i} className="relative">
                  <span
                    aria-hidden
                    className={`absolute -left-[29px] grid h-5 w-5 place-items-center rounded-full ring-4 ring-white ${i === 0 ? 'bg-amber-500' : 'bg-cyan-500'}`}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{t.event}</div>
                    <div className="shrink-0 text-xs text-slate-400">{formatDate(t.at)}</div>
                  </div>
                  {t.actor ? <div className="text-xs text-slate-500">{t.actor}</div> : null}
                  {t.note ? <div className="text-sm text-slate-700">{t.note}</div> : null}
                  <div className="text-xs text-slate-400">{formatTime(t.at)}</div>
                </li>
              ))}
            </ol>
          )
        ) : (
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-500">Description</dt>
              <dd className="mt-0.5 text-slate-700">{r.description ?? '—'}</dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs font-medium text-slate-500">Category</dt>
                <dd className="mt-0.5 text-slate-700">{r.type?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Priority</dt>
                <dd className="mt-0.5 text-slate-700">{r.priority?.name ?? '—'}</dd>
              </div>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Assigned to</dt>
              <dd className="mt-0.5 text-slate-700">{r.assigned_department?.name ?? 'Not assigned yet'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Submitted</dt>
              <dd className="mt-0.5 text-slate-700">{formatDate(r.created_at)}{formatTime(r.created_at) ? ` ${formatTime(r.created_at)}` : ''}</dd>
            </div>
            {r.media && r.media.length > 0 ? (
              <div>
                <dt className="text-xs font-medium text-slate-500">Evidence ({r.media.length})</dt>
                <dd className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {r.media.map((m, i) => (
                    <div key={i} className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      {m.kind === 'video' ? (
                        <div className="grid h-full w-full place-items-center text-2xl">🎥</div>
                      ) : m.signed_url || m.url ? (
                        <img src={m.signed_url ?? m.url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-slate-400">□</div>
                      )}
                    </div>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
        )}
      </section>

      {r.location ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-950">Location</h2>
          <div className="mt-2">
            <LocationMap
              latitude={r.location.latitude}
              longitude={r.location.longitude}
              label={r.location.address}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
