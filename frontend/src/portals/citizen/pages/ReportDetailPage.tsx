import { useParams, Link } from 'react-router-dom';
import { type JSX } from 'react';
import { useReportDetail, useReportTimeline } from '../api/client';
import { Spinner, EmptyState } from '../../moderator/design';

export default function ReportDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const detail = useReportDetail(id);
  const timeline = useReportTimeline(id);

  if (detail.isLoading) return <Spinner label="Loading report" />;
  if (detail.error || !detail.data) {
    const msg = detail.error instanceof Error ? detail.error.message : "Maybe it was deleted or you don't have access.";
    return (
      <EmptyState
        title="Couldn't load this report"
        description={msg}
        action={
          <Link to="/citizen" className="mt-2 rounded-full bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white">
            Back to home
          </Link>
        }
      />
    );
  }

  const r = detail.data;

  return (
    <div className="space-y-5">
      <header>
        <Link to="/citizen/reports" className="text-sm text-emerald-700 hover:underline">← My reports</Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{r.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{r.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{r.type?.name}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{r.priority?.name}</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">{r.status?.name}</span>
          {r.assigned_department && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">→ {r.assigned_department.name}</span>
          )}
        </div>
      </header>

      {r.ai_summary && (
        <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
          <h2 className="text-sm font-semibold text-violet-900">AI analysis</h2>
          {r.ai_summary.labels && r.ai_summary.labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.ai_summary.labels.map((l) => (
                <span key={l.name} className="rounded-full bg-white px-2 py-0.5 text-xs text-violet-800 ring-1 ring-violet-200">
                  {l.name} · {Math.round(l.confidence * 100)}%
                </span>
              ))}
            </div>
          )}
          {r.ai_summary.recommended_department && (
            <p className="mt-2 text-xs text-violet-900">Suggested: <strong>{r.ai_summary.recommended_department.name}</strong></p>
          )}
          {typeof r.ai_summary.fraud_score === 'number' && (
            <p className="mt-1 text-xs text-violet-900">Fraud score: <strong>{Math.round(r.ai_summary.fraud_score * 100)}%</strong></p>
          )}
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-700">Timeline</h2>
        {timeline.isLoading ? (
          <Spinner label="Loading timeline" />
        ) : (
          <ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-5">
            {(timeline.data ?? []).map((t, i) => (
              <li key={i} className="relative">
                <span aria-hidden className="absolute -left-[27px] grid h-4 w-4 place-items-center rounded-full bg-emerald-500 ring-4 ring-white" />
                <div className="text-sm font-semibold text-slate-900">{t.event}</div>
                {t.actor && <div className="text-xs text-slate-500">{t.actor}</div>}
                {t.note && <div className="text-sm text-slate-700">{t.note}</div>}
                <div className="text-xs text-slate-400">{new Date(t.at).toLocaleString()}</div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {r.location && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700">Location</h2>
          <p className="mt-1 text-sm text-slate-700">
            {r.location.latitude.toFixed(5)}, {r.location.longitude.toFixed(5)}
            {r.location.address && ` — ${r.location.address}`}
          </p>
        </section>
      )}
    </div>
  );
}
