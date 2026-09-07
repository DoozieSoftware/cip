import { type JSX } from 'react';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { Spinner } from '../../../shared/ui';
import type { TextileCapacityEvaluation } from '../api/textileApi';

export type CapacityWarningBannerProps = {
  evaluation?: TextileCapacityEvaluation | null;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  className?: string;
};

export function CapacityWarningBanner({
  evaluation,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  className,
}: CapacityWarningBannerProps): JSX.Element | null {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Checking capacity"
        className={`flex items-center gap-2 rounded-md border border-[var(--color-border-subtle)] bg-white px-2.5 py-2 text-xs text-[var(--color-text-secondary)] ${className ?? ''}`}
      >
        <Spinner label="Checking capacity" />
        Checking capacity…
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className={`rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 ${className ?? ''}`}
      >
        <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
          <IconAlertTriangle className="h-3.5 w-3.5" stroke={1.65} />
          Could not check load
        </p>
        <p className="mt-0.5 text-[11px] leading-4 text-amber-700">
          {errorMessage ??
            'We could not check the load. You can still continue — limits will be checked on confirm, or retry.'}
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1.5 inline-flex h-7 items-center rounded-full border border-amber-300 bg-white px-3 text-[11px] font-medium text-amber-800"
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  if (!evaluation) return null;

  const blockers = evaluation.blockers ?? [];
  const warnings = evaluation.warnings ?? [];
  const hasBlockers = blockers.length > 0;
  const hasWarnings = warnings.length > 0;

  if (!hasBlockers && !hasWarnings) return null;

  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      {hasBlockers ? (
        <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-800">
            <IconAlertTriangle className="h-3.5 w-3.5" stroke={1.65} />
            Truck full — cannot add this trip as planned
          </p>
          {evaluation.totals ? (
            <p className="mt-0.5 text-[11px] leading-4 text-rose-700">
              This trip: {evaluation.totals.bags} bags · {evaluation.totals.weight_kg} kg ·{' '}
              {evaluation.totals.stops} stops
              {evaluation.effective_rule
                ? ` · Limit: ${evaluation.effective_rule.max_bags ?? '—'} / ${evaluation.effective_rule.max_weight_kg ?? '—'} kg / ${evaluation.effective_rule.max_stops ?? '—'} stops`
                : ''}
            </p>
          ) : null}
          <ul className="mt-1 space-y-1">
            {blockers.map((item) => (
              <li key={item.code} className="text-xs leading-4 text-rose-800">
                {item.message}
              </li>
            ))}
          </ul>
          {evaluation.effective_rule?.guidance_text ? (
            <p className="mt-1 text-[11px] text-rose-700">
              {evaluation.effective_rule.guidance_text}
            </p>
          ) : null}
        </div>
      ) : null}

      {hasWarnings ? (
        <div role="status" className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <IconInfoCircle className="h-3.5 w-3.5" stroke={1.65} />
            Close to limits — check before confirming
          </p>
          {evaluation.totals ? (
            <p className="mt-0.5 text-[11px] leading-4 text-amber-700">
              This trip: {evaluation.totals.bags} bags · {evaluation.totals.weight_kg} kg ·{' '}
              {evaluation.totals.stops} stops
              {evaluation.effective_rule
                ? ` · Limit: ${evaluation.effective_rule.max_bags ?? '—'} / ${evaluation.effective_rule.max_weight_kg ?? '—'} kg / ${evaluation.effective_rule.max_stops ?? '—'} stops`
                : ''}
            </p>
          ) : null}
          <ul className="mt-1 space-y-1">
            {warnings.map((item) => (
              <li key={item.code} className="text-xs leading-4 text-amber-800">
                {item.message}
              </li>
            ))}
          </ul>
          {evaluation.effective_rule?.guidance_text ? (
            <p className="mt-1 text-[11px] text-amber-700">
              {evaluation.effective_rule.guidance_text}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
