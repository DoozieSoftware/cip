import { Link, useParams } from 'react-router-dom';
import { type JSX, useState } from 'react';
import {
  ArrowLeft,
  FileText,
  MapPin,
  Clock,
  CheckCircle,
  ChevronDown,
  Building2,
  Tag,
  AlertTriangle,
  Shield,
  Hash,
  Calendar,
  User,
  Image as ImageIcon,
} from 'lucide-react';
import { type ReportDetail, useReportDetail, useReportTimeline } from '../api/client';
import { EmptyState, Spinner } from '../../moderator/design';
import { StatusBadge } from '../components/StatusBadge';
import LocationMap from '../components/LocationMap';

type ReportMedia = ReportDetail['media'][number];

function EvidencePreview({
  media,
  compact = false,
}: {
  media: ReportMedia;
  compact?: boolean;
}): JSX.Element {
  const [failed, setFailed] = useState(false);
  const url = media.signed_url ?? media.url;

  if (!url || failed) {
    return (
      <div className="grid h-full w-full place-items-center px-3 text-center">
        <div className="flex flex-col items-center gap-2">
          <ImageIcon className="h-6 w-6 text-slate-300" />
          <span className="text-[11px] text-slate-400">Unavailable</span>
        </div>
      </div>
    );
  }

  if (media.kind === 'video') {
    return (
      <div className="relative h-full w-full bg-slate-950">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={url}
          aria-label="Video evidence"
          className="h-full w-full object-cover"
          controls={!compact}
          muted={compact}
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
        />
        {compact ? (
          <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            Video
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Report evidence"
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatReferenceId(id: string): string {
  const cleaned = id.replace(/-/g, '').toUpperCase();
  if (cleaned.length >= 8) {
    return `REF-${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
  }
  return `REF-${cleaned}`;
}

function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export default function ReportDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const detail = useReportDetail(id);
  const timeline = useReportTimeline(id);
  const [auditExpanded, setAuditExpanded] = useState(false);

  if (detail.isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
        <Spinner label="Loading official record" />
        <p className="text-sm text-slate-500">Retrieving your official record...</p>
      </div>
    );
  }

  if (detail.error || !detail.data) {
    const msg =
      detail.error instanceof Error
        ? detail.error.message
        : "Maybe it was deleted or you don't have access.";
    return (
      <div className="px-4 py-8">
        <EmptyState
          title="Record Not Found"
          description={msg}
          action={
            <Link
              to="/citizen/reports"
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 shadow-sm active:bg-slate-50"
            >
              Return to My Reports
            </Link>
          }
        />
      </div>
    );
  }

  const r = detail.data;

  return (
    <div className="mx-auto max-w-3xl pb-12">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            to="/citizen/reports"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm active:bg-slate-50"
            aria-label="Back to My Reports"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{r.title}</p>
            <p className="font-mono text-xs text-slate-400">{formatReferenceId(r.id)}</p>
          </div>
          <StatusBadge status={r.status} className="shrink-0" />
        </div>
      </header>

      <div className="space-y-5 px-4 pt-6">
        {/* Title & Reference Card */}
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                <Hash className="h-3.5 w-3.5" />
                Official Reference
              </div>
              <p className="mt-2 font-mono text-xl font-bold tracking-wide text-slate-900">
                {formatReferenceId(r.id)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {r.is_verified ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Pending
                </span>
              )}
            </div>
          </div>

          <div className="mt-5 border-t border-slate-50 pt-5">
            <h1 className="text-2xl font-bold leading-tight text-slate-900">{r.title}</h1>
            {r.description ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                {r.description}
              </p>
            ) : (
              <p className="mt-3 text-sm italic text-slate-400">No description provided.</p>
            )}
          </div>
        </section>

        {/* Status Timeline */}
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            Status Timeline
          </h2>
          <div className="mt-5">
            {timeline.isLoading ? (
              <div className="flex items-center gap-3 py-4">
                <Spinner label="Loading timeline" />
                <span className="text-sm text-slate-500">Loading status history...</span>
              </div>
            ) : timeline.data && timeline.data.length > 0 ? (
              <ol className="relative">
                {timeline.data.map((t, i) => {
                  const isLatest = i === 0;
                  return (
                    <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
                      {i < timeline.data.length - 1 ? (
                        <span
                          aria-hidden
                          className="absolute left-[11px] top-6 h-full w-0.5 bg-slate-100"
                        />
                      ) : null}
                      <span
                        aria-hidden
                        className={`relative z-10 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full ${
                          isLatest
                            ? 'bg-emerald-500 ring-[3px] ring-emerald-100'
                            : 'bg-slate-200 ring-[3px] ring-white'
                        }`}
                      >
                        <span
                          className={`block rounded-full ${isLatest ? 'h-2 w-2 bg-white' : 'h-1.5 w-1.5 bg-slate-400'}`}
                        />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-semibold ${isLatest ? 'text-slate-900' : 'text-slate-600'}`}
                            >
                              {t.event}
                            </span>
                            {isLatest ? (
                              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                Current
                              </span>
                            ) : null}
                          </div>
                          <time className="text-xs text-slate-400">
                            {formatDate(t.at)}
                            {formatTime(t.at) ? ` · ${formatTime(t.at)}` : ''}
                          </time>
                        </div>
                        {t.actor ? (
                          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                            <User className="h-3 w-3" />
                            {t.actor}
                          </p>
                        ) : null}
                        {t.note ? (
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{t.note}</p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-500">No status updates yet</p>
                <p className="mt-1 text-xs text-slate-400">Status changes will appear here.</p>
              </div>
            )}
          </div>
        </section>

        {/* Quick Details Grid */}
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <FileText className="h-3.5 w-3.5" />
            Report Details
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-5 lg:grid-cols-4">
            <DetailBlock
              icon={<Tag className="h-3.5 w-3.5" />}
              label="Category"
              value={r.type?.name ?? '—'}
            />
            <DetailBlock
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              label="Priority"
              value={r.priority?.name ?? '—'}
            />
            <DetailBlock
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Submitted"
              value={`${formatDate(r.created_at)}${formatTime(r.created_at) ? ` · ${formatTime(r.created_at)}` : ''}`}
            />
            <DetailBlock
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Assigned To"
              value={r.assigned_department?.name ?? 'Pending Assignment'}
            />
          </div>
        </section>

        {/* Department Card */}
        {r.assigned_department ? (
          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Building2 className="h-3.5 w-3.5" />
              Department Assignment
            </h2>
            <div className="mt-5 flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-50">
                <Building2 className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{r.assigned_department.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  This department is responsible for reviewing and resolving your report.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {/* Location Card */}
        {r.location ? (
          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              Location
            </h2>
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-100">
              <LocationMap
                latitude={r.location.latitude}
                longitude={r.location.longitude}
                label={r.location.address}
                height={180}
              />
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm text-slate-700">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                {r.location.address ?? 'Address not available'}
              </p>
              <p className="shrink-0 font-mono text-xs text-slate-400">
                {formatCoordinates(r.location.latitude, r.location.longitude)}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">
                Location captured at time of submission
              </span>
            </div>
          </section>
        ) : null}

        {/* Evidence Grid */}
        {r.media && r.media.length > 0 ? (
          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <ImageIcon className="h-3.5 w-3.5" />
                Evidence
              </h2>
              <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                {r.media.length} {r.media.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {r.media.map((m, i) => (
                <div
                  key={m.id}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-slate-100 bg-slate-50"
                >
                  <EvidencePreview media={m} />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 py-2">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                      EVD-{String(i + 1).padStart(2, '0')}
                    </p>
                  </div>
                  {m.kind === 'video' ? (
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase text-white">
                        Video
                      </span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
            <ImageIcon className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">No Evidence Attached</p>
            <p className="mt-1 text-xs text-slate-400">
              This record does not contain any supporting evidence.
            </p>
          </section>
        )}

        {/* AI Insights */}
        {r.ai_summary ? (
          <section className="rounded-2xl border border-sky-100 bg-sky-50/30 p-6">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Shield className="h-3.5 w-3.5" />
              Automated Analysis
            </h2>
            <div className="mt-5 space-y-5">
              {r.ai_summary.labels && r.ai_summary.labels.length > 0 ? (
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Detected Labels
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {r.ai_summary.labels.map((l) => (
                      <span
                        key={l.name}
                        className="rounded-full border border-sky-100 bg-white px-3 py-1 text-xs font-medium text-sky-800"
                      >
                        {l.name}
                        <span className="ml-1 text-sky-500">
                          ({Math.round(l.confidence * 100)}%)
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {r.ai_summary.recommended_department ? (
                  <DetailBlock
                    icon={<Building2 className="h-3.5 w-3.5" />}
                    label="Recommended Department"
                    value={r.ai_summary.recommended_department.name}
                  />
                ) : null}
                {typeof r.ai_summary.fraud_score === 'number' ? (
                  <DetailBlock
                    icon={<Shield className="h-3.5 w-3.5" />}
                    label="Evidence Review Score"
                    value={`${Math.round(r.ai_summary.fraud_score * 100)}%`}
                  />
                ) : null}
              </div>
            </div>
            <p className="mt-5 rounded-xl border border-sky-100 bg-white px-4 py-3 text-xs leading-relaxed text-sky-800">
              <strong>Note:</strong> This automated analysis is for informational purposes only. All
              reports are subject to official review by a moderator or department officer before
              action is taken.
            </p>
          </section>
        ) : null}

        {/* Audit History - Collapsible */}
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setAuditExpanded(!auditExpanded)}
            className="flex w-full items-center justify-between gap-2 px-6 py-4 text-left active:bg-slate-50"
            aria-expanded={auditExpanded}
          >
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              Audit History
            </h2>
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${auditExpanded ? 'rotate-180' : ''}`}
            />
          </button>
          {auditExpanded ? (
            <div className="border-t border-slate-50 px-6 py-5">
              {timeline.isLoading ? (
                <div className="flex items-center gap-3 py-4">
                  <Spinner label="Loading audit history" />
                  <span className="text-sm text-slate-500">Loading...</span>
                </div>
              ) : timeline.data && timeline.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="pb-3 pr-4 font-semibold">Event</th>
                        <th className="pb-3 pr-4 font-semibold">Date</th>
                        <th className="pb-3 font-semibold">Actor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeline.data.map((t, i) => (
                        <tr key={i} className="border-b border-slate-50 last:border-0">
                          <td className="py-3 pr-4 font-medium text-slate-900">{t.event}</td>
                          <td className="py-3 pr-4 whitespace-nowrap text-slate-500">
                            {formatDate(t.at)}
                            {formatTime(t.at) ? (
                              <span className="ml-1 text-xs">{formatTime(t.at)}</span>
                            ) : null}
                          </td>
                          <td className="py-3 text-slate-500">{t.actor ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-slate-500">No audit entries yet.</p>
              )}
            </div>
          ) : null}
        </section>

        {/* Footer Notice */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
          <p className="text-center text-xs leading-relaxed text-slate-500">
            This is an official record generated by the Civic Intelligence Platform. Reference{' '}
            <span className="font-mono font-semibold text-slate-700">
              {formatReferenceId(r.id)}
            </span>{' '}
            must be quoted in all correspondence.
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-50 bg-slate-50/50 p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 truncate text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
