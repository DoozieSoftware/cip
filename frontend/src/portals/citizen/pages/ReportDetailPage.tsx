import { Link, useParams } from 'react-router-dom';
import { type JSX, useState, useMemo } from 'react';
import { useMessages } from '../messages';
import {
  IconArrowLeft,
  IconFileText,
  IconMapPin,
  IconClock,
  IconCircleCheck,
  IconChevronDown,
  IconCalendar,
  IconUser,
  IconBuilding,
  IconCamera,
  IconAlertTriangle,
} from '@tabler/icons-react';
import {
  useDisputeResolution,
  useReportDetail,
  useReportTimeline,
  useVerifyResolution,
  lifecycleGroup,
} from '../api/client';
import {
  citizenReportStatusLabel,
  citizenReportStatusMeaning,
} from '../../../shared/statusDisplay';
import { EmptyState, Spinner } from '../../../shared/ui';
import { StatusBadge } from '../components/StatusBadge';
import LocationMap from '../components/LocationMap';
import MergeDisputeCard from '../components/MergeDisputeCard';
import { CitizenResolutionCard } from '../components/CitizenResolutionCard';
import type { ReportDetail } from '../types';
import type { MessageKey } from '../messages';

type ReportMedia = ReportDetail['media'][number];
type TimelineEntry = ReportDetail['timeline'][number];

// A report is not yet handed to a department while it's still being
// checked by AI or a human moderator — see docs/mom-product-decisions.md §2.
const PRE_ASSIGNMENT_STATUSES = new Set(['submitted', 'ai_processing', 'pending_moderator']);

interface CitizenMilestone {
  key: string;
  label: string;
  actorLabel: string | null;
  meaning: string | null;
  at: string;
}

function citizenActorLabel(
  entry: TimelineEntry,
  t: (key: MessageKey) => string,
  departmentName: string | null,
): string | null {
  switch (entry.actor_role) {
    case 'citizen':
      return t('detail.timelineActorYou');
    case 'moderator':
      return t('detail.timelineActorModerator');
    case 'department_officer':
    case 'department':
      return departmentName ?? t('detail.timelineActorDepartment');
    case 'super_admin':
      return t('detail.timelineActorAdmin');
    default:
      return t('detail.timelineActorSystem');
  }
}

// Several internal statuses (submitted / ai_processing / pending_moderator)
// all mean "Received" to a citizen — collapse consecutive raw transitions
// that map to the same plain-language label into one milestone, per
// docs/mom-product-decisions.md §2 ("Do not expose raw status codes in UI").
function buildCitizenMilestones(
  entries: TimelineEntry[],
  t: (key: MessageKey) => string,
  departmentName: string | null,
): CitizenMilestone[] {
  const chronological = [...entries].sort((a, b) => a.at.localeCompare(b.at));
  const milestones: CitizenMilestone[] = [];

  for (const entry of chronological) {
    const label = citizenReportStatusLabel(entry.to_status_code);
    const previous = milestones[milestones.length - 1];
    if (previous && previous.label === label) {
      continue;
    }
    milestones.push({
      key: entry.id ?? entry.at,
      label,
      actorLabel: citizenActorLabel(entry, t, departmentName),
      // Plain-language explanation derived from the status code (per
      // docs/mom-product-decisions.md §2) — never the raw `entry.note`,
      // which carries internal/system wording not written for citizens.
      meaning: citizenReportStatusMeaning(entry.to_status_code),
      at: entry.at,
    });
  }

  return milestones.reverse();
}

function EvidencePreview({
  media,
  compact = false,
}: {
  media: ReportMedia;
  compact?: boolean;
}): JSX.Element {
  const [failed, setFailed] = useState(false);
  const { t } = useMessages();
  const url = media.signed_url ?? media.url;

  if (!url || failed) {
    return (
      <div className="grid h-full w-full place-items-center px-3 text-center">
        <div className="flex flex-col items-center gap-2">
          <IconCamera className="h-6 w-6 text-[#bfbbb2]" />
          <span className="text-[11px] text-[var(--color-text-tertiary)]">
            {t('detail.unavailable')}
          </span>
        </div>
      </div>
    );
  }

  if (media.kind === 'video') {
    return (
      <div className="relative h-full w-full bg-[var(--color-ink)]">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={url}
          aria-label={t('detail.videoEvidence')}
          className="h-full w-full object-cover"
          controls={!compact}
          muted={compact}
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
        />
        {compact ? (
          <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            {t('detail.video')}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={t('detail.evidence')}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function formatDate(value: string | null | undefined, locale = 'en-IN'): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(value: string | null | undefined, locale = 'en-IN'): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatLocation(address: string | null | undefined, unavailable: string): string {
  return address ?? unavailable;
}

export default function ReportDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useMessages();
  const detail = useReportDetail(id);
  const timeline = useReportTimeline(id);
  const verifyResolution = useVerifyResolution(id ?? '');
  const disputeResolution = useDisputeResolution(id ?? '');
  const [auditExpanded, setAuditExpanded] = useState(false);

  const departmentName =
    detail.data?.assigned_department?.name ?? detail.data?.department?.name ?? null;

  const citizenMilestones = useMemo(() => {
    if (!timeline.data) return [];
    return buildCitizenMilestones(timeline.data, t, departmentName);
  }, [timeline.data, t, departmentName]);

  const sortedTimeline = useMemo(() => {
    if (!timeline.data) return [];
    return [...timeline.data].sort((a, b) => b.at.localeCompare(a.at));
  }, [timeline.data]);

  if (detail.isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
        <Spinner label={t('spinner.loadingOfficialRecord')} />
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t('spinner.retrievingRecord')}
        </p>
      </div>
    );
  }

  if (detail.error || !detail.data) {
    const msg =
      detail.error instanceof Error ? detail.error.message : t('detail.recordNotFoundDetail');
    return (
      <div className="px-4 py-8">
        <EmptyState
          title={t('detail.recordNotFound')}
          description={msg}
          action={
            <Link
              to="/citizen/reports"
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full border border-black/15 bg-white px-6 text-sm font-medium text-[var(--color-ink)] hover:border-black/30"
            >
              {t('detail.backToReports')}
            </Link>
          }
        />
      </div>
    );
  }

  const r = detail.data;
  const statusMeaning = citizenReportStatusMeaning(r.status.code);

  return (
    <div className="mx-auto max-w-3xl bg-[var(--color-canvas)] pb-12">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--color-border-faint)] bg-[var(--color-canvas)] px-4 pb-4 pt-3">
        <div className="flex items-center gap-3">
          <Link
            to="/citizen/reports"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#d8d6cf] bg-[#faf9f6] text-[var(--color-ink)] hover:bg-white"
            aria-label={t('detail.backToReports')}
          >
            <IconArrowLeft className="h-5 w-5" stroke={1.6} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--color-ink)]">{r.title}</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              {r.tracking_number}
            </p>
          </div>
          <StatusBadge status={r.status} className="shrink-0" />
        </div>
      </header>

      <div className="space-y-4 px-4 pt-4">
        <CitizenResolutionCard
          report={r}
          onVerify={() => verifyResolution.mutate(r.workflow_version)}
          onDispute={(reason) =>
            disputeResolution.mutate({
              reason,
              expectedWorkflowVersion: r.workflow_version,
            })
          }
          isVerifying={verifyResolution.isPending}
          isDisputing={disputeResolution.isPending}
          error={
            verifyResolution.error instanceof Error
              ? verifyResolution.error.message
              : disputeResolution.error instanceof Error
                ? disputeResolution.error.message
                : null
          }
        />
        {/* Title Section */}
        <section className="rounded-xl bg-white p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            <IconFileText className="h-3.5 w-3.5" stroke={1.6} />
            {t('detail.officialReference')}
          </div>
          <p className="mt-1 font-mono text-lg font-bold tracking-wide text-[var(--color-ink)]">
            {r.tracking_number}
          </p>
          <div className="mt-3 flex items-center gap-2">
            {lifecycleGroup(r.status.code) === 'closed' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <IconCircleCheck className="h-3.5 w-3.5" stroke={1.6} />
                {citizenReportStatusLabel(r.status.code)}
              </span>
            ) : lifecycleGroup(r.status.code) === 'rejected' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                <IconAlertTriangle className="h-3.5 w-3.5" stroke={1.6} />
                {citizenReportStatusLabel(r.status.code)}
              </span>
            ) : lifecycleGroup(r.status.code) === 'merged' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                <IconAlertTriangle className="h-3.5 w-3.5" stroke={1.6} />
                {citizenReportStatusLabel(r.status.code)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <IconAlertTriangle className="h-3.5 w-3.5" stroke={1.6} />
                {citizenReportStatusLabel(r.status.code)}
              </span>
            )}
          </div>
          {statusMeaning ? (
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
              {statusMeaning}
            </p>
          ) : null}
          {lifecycleGroup(r.status.code) === 'merged' && r.canonical_report ? (
            <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
              <p className="text-xs font-medium text-violet-800">
                {t('detail.mergedInto')}{' '}
                <Link
                  to={r.canonical_report.link}
                  className="font-mono font-semibold text-violet-900 underline hover:text-violet-700"
                >
                  {r.canonical_report.tracking_number}
                </Link>
              </p>
              <p className="mt-1 text-xs text-violet-700">{t('detail.mergedIntoHint')}</p>
            </div>
          ) : null}
          {lifecycleGroup(r.status.code) === 'merged' ? (
            <MergeDisputeCard
              reportId={r.id}
              workflowVersion={r.workflow_version}
              mergeDispute={r.merge_dispute ?? null}
            />
          ) : null}
          <div className="mt-4 border-t border-[var(--color-border-subtle)] pt-4">
            <h1 className="text-xl font-bold leading-tight text-[var(--color-ink)]">{r.title}</h1>
            {r.description ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {r.description}
              </p>
            ) : (
              <p className="mt-2 text-sm italic text-[var(--color-text-tertiary)]">
                {t('detail.noDescription')}
              </p>
            )}
          </div>
        </section>

        {/* Quick Details */}
        <div className="rounded-xl bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <DetailBlock
              icon={<IconFileText className="h-3.5 w-3.5" stroke={1.6} />}
              label={t('detail.category')}
              value={r.type?.name ?? '—'}
            />
            <DetailBlock
              icon={<IconCalendar className="h-3.5 w-3.5" stroke={1.6} />}
              label={t('detail.submitted')}
              value={`${formatDate(r.created_at, locale)}${formatTime(r.created_at, locale) ? ` · ${formatTime(r.created_at, locale)}` : ''}`}
            />
            <DetailBlock
              icon={<IconBuilding className="h-3.5 w-3.5" stroke={1.6} />}
              label={t('detail.assignedTo')}
              value={
                r.assigned_department?.name ??
                r.department?.name ??
                (PRE_ASSIGNMENT_STATUSES.has(r.status.code)
                  ? t('detail.assignedPendingReview')
                  : t('detail.pending'))
              }
            />
          </div>
        </div>

        {/* Status Timeline */}
        <section className="rounded-xl bg-white p-4">
          <h2 className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-surface-alt)]">
              <IconClock className="h-3.5 w-3.5 text-[var(--color-ink)]" stroke={1.7} />
            </span>
            {t('detail.statusTimeline')}
          </h2>
          <div className="mt-4">
            {timeline.isLoading ? (
              <div className="flex items-center gap-3 py-4">
                <Spinner label={t('spinner.loadingTimeline')} />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {t('detail.loadingStatusHistory')}
                </span>
              </div>
            ) : citizenMilestones.length > 0 ? (
              <ol className="relative">
                {citizenMilestones.map((milestone, i) => {
                  const isLatest = i === 0;
                  return (
                    <li key={milestone.key} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < citizenMilestones.length - 1 ? (
                        <span
                          aria-hidden
                          className="absolute left-[9px] top-5 h-full w-0.5 bg-[var(--color-border-subtle)]"
                        />
                      ) : null}
                      <span
                        aria-hidden
                        className={`relative z-10 grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full ${
                          isLatest
                            ? 'bg-emerald-500 ring-[3px] ring-emerald-100'
                            : 'bg-[var(--color-border-subtle)] ring-[3px] ring-white'
                        }`}
                      >
                        <span
                          className={`block rounded-full ${isLatest ? 'h-2 w-2 bg-white' : 'h-1.5 w-1.5 text-[var(--color-text-tertiary)]'}`}
                        />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-medium ${isLatest ? 'text-[var(--color-ink)]' : 'text-[var(--color-text-secondary)]'}`}
                            >
                              {milestone.label}
                            </span>
                            {isLatest ? (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                {t('detail.current')}
                              </span>
                            ) : null}
                          </div>
                          <time className="text-xs text-[var(--color-text-tertiary)]">
                            {formatDate(milestone.at, locale)}
                            {formatTime(milestone.at, locale)
                              ? ` · ${formatTime(milestone.at, locale)}`
                              : ''}
                          </time>
                        </div>
                        {milestone.actorLabel ? (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                            <IconUser className="h-3 w-3" stroke={1.6} />
                            {milestone.actorLabel}
                          </p>
                        ) : null}
                        {milestone.meaning ? (
                          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                            {milestone.meaning}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                  <IconClock className="h-5 w-5 text-[var(--color-text-tertiary)]" stroke={1.6} />
                </span>
                <p className="text-sm font-medium text-[var(--color-ink)]">
                  {t('detail.noStatusUpdates')}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {t('detail.statusChangesHere')}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Department Card */}
        {r.assigned_department || r.department ? (
          <section className="rounded-xl bg-white p-4">
            <h2 className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                <IconBuilding className="h-3.5 w-3.5 text-[var(--color-ink)]" stroke={1.7} />
              </span>
              {t('detail.departmentAssignment')}
            </h2>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                <IconBuilding className="h-5 w-5 text-[var(--color-text-secondary)]" stroke={1.6} />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">
                  {r.assigned_department?.name ?? r.department?.name ?? t('detail.pending')}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {t('detail.responsibleFor')}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {/* Location Card */}
        {r.location ? (
          <section className="rounded-xl bg-white p-4">
            <h2 className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                <IconMapPin className="h-3.5 w-3.5 text-[var(--color-ink)]" stroke={1.7} />
              </span>
              {t('detail.location')}
            </h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-[var(--color-border-subtle)]">
              <LocationMap
                latitude={r.location.latitude}
                longitude={r.location.longitude}
                label={r.location.address}
                height={160}
              />
            </div>
            <div className="mt-3">
              <p className="flex items-start gap-2 text-sm text-[var(--color-ink)]">
                <IconMapPin
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]"
                  stroke={1.6}
                />
                {formatLocation(r.location.address, t('detail.addressNotAvailable'))}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <IconCircleCheck className="h-4 w-4 text-emerald-600" stroke={1.7} />
              <span className="text-xs font-medium text-emerald-700">
                {t('detail.locationCaptured')}
              </span>
            </div>
          </section>
        ) : null}

        {/* Evidence Grid */}
        {r.media && r.media.length > 0 ? (
          <section className="rounded-xl bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                  <IconCamera className="h-3.5 w-3.5 text-[var(--color-ink)]" stroke={1.7} />
                </span>
                {t('detail.evidence')}
              </h2>
              <span className="rounded-full bg-[var(--color-surface-alt)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                {t('detail.evidenceCount', {
                  count: r.media.length,
                  plural:
                    r.media.length === 1
                      ? t('detail.evidenceSingular')
                      : t('detail.evidencePlural'),
                })}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {r.media.map((m, i) => (
                <div
                  key={m.id}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[#faf9f6]"
                >
                  <EvidencePreview media={m} />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                      EVD-{String(i + 1).padStart(2, '0')}
                    </p>
                  </div>
                  {m.kind === 'video' ? (
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        {t('detail.video')}
                      </span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="flex flex-col items-center gap-2 rounded-xl bg-white p-8 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-surface-alt)]">
              <IconCamera className="h-5 w-5 text-[var(--color-text-tertiary)]" stroke={1.6} />
            </span>
            <p className="text-sm font-medium text-[var(--color-ink)]">{t('detail.noEvidence')}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {t('detail.noEvidenceDetail')}
            </p>
          </section>
        )}

        {/* Audit History - Collapsible */}
        <section className="overflow-hidden rounded-xl bg-white">
          <button
            type="button"
            onClick={() => setAuditExpanded(!auditExpanded)}
            className="flex w-full items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] px-4 py-3.5 text-left active:bg-[#faf9f6]"
            aria-expanded={auditExpanded}
          >
            <h2 className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                <IconClock
                  className="h-3.5 w-3.5 text-[var(--color-text-secondary)]"
                  stroke={1.7}
                />
              </span>
              {t('detail.auditHistory')}
            </h2>
            <IconChevronDown
              className={`h-5 w-5 shrink-0 text-[var(--color-text-tertiary)] transition-transform duration-200 ${auditExpanded ? 'rotate-180' : ''}`}
              stroke={1.6}
            />
          </button>
          {auditExpanded ? (
            <div className="px-4 py-4">
              {timeline.isLoading ? (
                <div className="flex items-center gap-3 py-4">
                  <Spinner label={t('detail.loadingAudit')} />
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {t('detail.loadingDots')}
                  </span>
                </div>
              ) : sortedTimeline.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border-subtle)] font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                        <th className="pb-2.5 pr-3 font-semibold">{t('detail.auditEvent')}</th>
                        <th className="pb-2.5 pr-3 font-semibold">{t('detail.auditDate')}</th>
                        <th className="pb-2.5 font-semibold">{t('detail.auditActor')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTimeline.map((entry, i) => (
                        <tr
                          key={i}
                          className="border-b border-[var(--color-border-subtle)] last:border-0"
                        >
                          <td className="py-2.5 pr-3 font-medium text-[var(--color-ink)]">
                            {entry.event}
                          </td>
                          <td className="py-2.5 pr-3 whitespace-nowrap text-[var(--color-text-secondary)]">
                            {formatDate(entry.at, locale)}
                            {formatTime(entry.at, locale) ? (
                              <span className="ml-1 text-xs">{formatTime(entry.at, locale)}</span>
                            ) : null}
                          </td>
                          <td className="py-2.5 text-[var(--color-text-secondary)]">
                            {entry.actor ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
                  {t('detail.noAuditEntries')}
                </p>
              )}
            </div>
          ) : null}
        </section>

        {/* Footer Notice */}
        <div className="rounded-xl bg-white p-4">
          <p className="text-center text-xs leading-relaxed text-[var(--color-text-secondary)]">
            {t('detail.officialRecordNotice', { reference: r.tracking_number })}
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
    <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[#faf9f6] p-3">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
        {icon}
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-medium text-[var(--color-ink)]">{value}</p>
    </div>
  );
}
