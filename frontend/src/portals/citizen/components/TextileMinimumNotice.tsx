/* eslint-disable react-refresh/only-export-components */
import type { JSX } from 'react';
import type { TextileCapacityMinimum, TextileCollectionMethod } from '../api/textileZones';

export interface TextileMinimumNoticeProps {
  minimum?: TextileCapacityMinimum | null;
  estimatedBags?: number | null;
  estimatedWeightKg?: number | null;
  isLoading?: boolean;
  isError?: boolean;
  collectionMethod?: TextileCollectionMethod | null;
  onRetry?: () => void;
}

export const isBelowMinimum = (
  minimum: TextileCapacityMinimum | null | undefined,
  estimatedBags: number | null | undefined,
  estimatedWeightKg: number | null | undefined,
  collectionMethod?: TextileCollectionMethod | null,
): boolean => {
  if (collectionMethod === 'dropoff') return false;
  if (!minimum) return false;
  const hasMinBags = minimum.min_bags !== null && minimum.min_bags !== undefined;
  const hasMinWeight = minimum.min_weight_kg !== null && minimum.min_weight_kg !== undefined;
  if (!hasMinBags && !hasMinWeight) return false;

  const checks = [
    hasMinBags && estimatedBags !== null && estimatedBags !== undefined
      ? estimatedBags >= (minimum.min_bags as number)
      : null,
    hasMinWeight && estimatedWeightKg !== null && estimatedWeightKg !== undefined
      ? estimatedWeightKg >= (minimum.min_weight_kg as number)
      : null,
  ].filter((check): check is boolean => check !== null);

  return checks.length > 0 && !checks.some(Boolean);
};

export function TextileMinimumNotice({
  minimum,
  estimatedBags = null,
  estimatedWeightKg = null,
  isLoading = false,
  isError = false,
  collectionMethod = null,
  onRetry,
}: TextileMinimumNoticeProps): JSX.Element {
  const isDropoff = collectionMethod === 'dropoff';

  if (isDropoff) {
    return (
      <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] p-3 text-xs leading-5 text-[var(--color-text-secondary)]">
        <p className="font-medium text-[var(--color-ink)]">No minimum for drop-off</p>
        <p className="mt-1">Take any amount to the centre — open during centre hours.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] p-3 text-xs leading-5 text-[var(--color-text-secondary)]">
        <p className="font-medium text-[var(--color-ink)]">How much is needed for a home pickup?</p>
        <p className="mt-1">Checking what’s needed in your area…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
        <p role="alert" className="font-medium">
          Could not check the minimum right now.
        </p>
        <p className="mt-1 text-[11px] leading-4 text-red-600">
          Retry before sending a home-pickup request. Drop-off accepts any amount.
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex min-h-11 items-center rounded-full border border-red-300 bg-white px-4 text-xs font-medium text-red-800"
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  const hasMinimum =
    minimum !== null &&
    minimum !== undefined &&
    (minimum.min_bags !== null || minimum.min_weight_kg !== null);

  if (!hasMinimum) {
    return (
      <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] p-3 text-xs leading-5 text-[var(--color-text-secondary)]">
        <p className="font-medium text-[var(--color-ink)]">How much is needed for a home pickup?</p>
        <p className="mt-1">
          No pickup minimum is set for your area right now — send any amount for home pickup.
        </p>
      </div>
    );
  }

  const belowMinimum = isBelowMinimum(minimum, estimatedBags, estimatedWeightKg, collectionMethod);

  const minParts: string[] = [];
  if (minimum.min_bags !== null) minParts.push(`${minimum.min_bags} bags`);
  if (minimum.min_weight_kg !== null) minParts.push(`${minimum.min_weight_kg} kg`);
  const minText = minParts.join(' or ');

  return (
    <div
      className={`rounded-lg border p-3 text-xs leading-5 ${belowMinimum ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]'}`}
    >
      <p className="font-medium text-[var(--color-ink)]">How much is needed for a home pickup?</p>
      <p className="mt-1">
        In your area: <span className="font-semibold text-[var(--color-ink)]">{minText}</span> for a
        pickup trip.
        {minimum.guidance_text ? ` ${minimum.guidance_text}` : null}
      </p>
      {!minimum.guidance_text ? (
        <p className="mt-1 text-[11px] leading-4 text-[var(--color-text-secondary)]">
          Fill bags or kg — either one is enough. For drop-off at a centre, any amount is OK.
        </p>
      ) : null}
      {belowMinimum ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-white p-3">
          <p className="text-xs font-semibold text-amber-900">
            Below the pickup minimum - home pickup needs {minText}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-[var(--color-text-secondary)]">
            Small loads waste a trip. Add more bags, or choose drop-off - any amount is accepted at
            the centre.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">
          Your estimate meets the guidance. No extra note needed.
        </p>
      )}
    </div>
  );
}

export default TextileMinimumNotice;
