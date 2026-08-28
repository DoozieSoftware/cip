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
  onRequestException?: () => void;
  requestExceptionLabel?: string;
  isRequestingException?: boolean;
  className?: string;
};

export function CapacityWarningBanner({
  evaluation,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  onRequestException,
  requestExceptionLabel = 'Request exception',
  isRequestingException,
  className,
}: CapacityWarningBannerProps): JSX.Element | null {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Checking capacity"
        className={`flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-xs text-[var(--color-text-secondary)] ${className ?? ''}`}
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
        className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 ${className ?? ''}`}
      >
        <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
          <IconAlertTriangle className="h-4 w-4" />
          Could not check capacity
        </p>
        {errorMessage ? <p className="mt-1 text-xs text-amber-700">{errorMessage}</p> : null}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 min-h-9 rounded-full border border-amber-300 bg-white px-3 text-xs font-medium text-amber-800"
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
    <div className={`space-y-2 ${className ?? ''}`}>
      {hasBlockers ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-800">
            <IconAlertTriangle className="h-4 w-4" />
            Capacity blocked — cannot schedule as configured
          </p>
          {evaluation.totals ? (
            <p className="mt-1 text-[11px] text-rose-700">
              Load: {evaluation.totals.bags} bags · {evaluation.totals.weight_kg} kg ·{' '}
              {evaluation.totals.stops} stops
              {evaluation.effective_rule
                ? ` · limits ${evaluation.effective_rule.max_bags ?? '—'} bags / ${evaluation.effective_rule.max_weight_kg ?? '—'} kg / ${evaluation.effective_rule.max_stops ?? '—'} stops`
                : ''}
            </p>
          ) : null}
          <ul className="mt-2 space-y-1.5">
            {blockers.map((item) => (
              <li key={item.code} className="flex gap-2 text-xs leading-4 text-rose-800">
                <span className="shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] leading-none text-rose-700">
                  {item.code}
                </span>
                <span className="flex-1">{item.message}</span>
              </li>
            ))}
          </ul>
          {evaluation.effective_rule?.guidance_text ? (
            <p className="mt-2 text-[11px] italic text-rose-700">
              {evaluation.effective_rule.guidance_text}
            </p>
          ) : null}
          {onRequestException ? (
            <div className="mt-3">
              <button
                type="button"
                disabled={!!isRequestingException}
                onClick={onRequestException}
                className="min-h-9 rounded-full bg-rose-700 px-4 text-xs font-medium text-white disabled:opacity-40"
              >
                {isRequestingException ? 'Requesting…' : requestExceptionLabel}
              </button>
              <p className="mt-1 text-[11px] text-rose-700">
                A reason is required — an authorised partner must approve the override.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {hasWarnings ? (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <IconInfoCircle className="h-4 w-4" />
            Capacity warning — review before confirming
          </p>
          {evaluation.totals ? (
            <p className="mt-1 text-[11px] text-amber-700">
              Load: {evaluation.totals.bags} bags · {evaluation.totals.weight_kg} kg ·{' '}
              {evaluation.totals.stops} stops
              {evaluation.effective_rule
                ? ` · limits ${evaluation.effective_rule.max_bags ?? '—'} bags / ${evaluation.effective_rule.max_weight_kg ?? '—'} kg / ${evaluation.effective_rule.max_stops ?? '—'} stops`
                : ''}
            </p>
          ) : null}
          <ul className="mt-2 space-y-1.5">
            {warnings.map((item) => (
              <li key={item.code} className="flex gap-2 text-xs leading-4 text-amber-800">
                <span className="shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] leading-none text-amber-700">
                  {item.code}
                </span>
                <span className="flex-1">{item.message}</span>
                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium capitalize text-amber-800">
                  {item.severity}
                </span>
              </li>
            ))}
          </ul>
          {evaluation.effective_rule?.guidance_text ? (
            <p className="mt-2 text-[11px] italic text-amber-700">
              {evaluation.effective_rule.guidance_text}
            </p>
          ) : null}
          {onRequestException ? (
            <div className="mt-3">
              <button
                type="button"
                disabled={!!isRequestingException}
                onClick={onRequestException}
                className="min-h-9 rounded-full border border-amber-300 bg-white px-4 text-xs font-medium text-amber-800 disabled:opacity-40"
              >
                {isRequestingException ? 'Requesting…' : requestExceptionLabel}
              </button>
              <p className="mt-1 text-[11px] text-amber-700">
                Explain why this trip needs an exception — a partner approver will decide.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
