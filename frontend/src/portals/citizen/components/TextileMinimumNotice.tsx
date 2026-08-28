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
  onRequestException?: () => void;
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

  const bagBelow =
    hasMinBags &&
    estimatedBags !== null &&
    estimatedBags !== undefined &&
    estimatedBags < (minimum.min_bags as number);
  const weightBelow =
    hasMinWeight &&
    estimatedWeightKg !== null &&
    estimatedWeightKg !== undefined &&
    estimatedWeightKg < (minimum.min_weight_kg as number);

  return Boolean(bagBelow || weightBelow);
};

export function TextileMinimumNotice({
  minimum,
  estimatedBags = null,
  estimatedWeightKg = null,
  isLoading = false,
  isError = false,
  collectionMethod = null,
  onRequestException,
  onRetry,
}: TextileMinimumNoticeProps): JSX.Element {
  const isDropoff = collectionMethod === 'dropoff';

  if (isDropoff) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
        No minimum — drop off any amount during centre hours.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <p className="font-medium">Minimum quantities for a collection route:</p>
        <p className="mt-1">Loading this partner&apos;s guidance…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        <p role="alert" className="font-medium">
          Could not load minimum guidance.
        </p>
        <p className="mt-1 text-[11px] text-red-600">
          Your request can still be submitted — it will be reviewed before scheduling.
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-800"
          >
            Retry
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
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
        <p className="font-medium">Minimum quantities for a collection route:</p>
        <p className="mt-1">
          This partner has not configured a minimum. Your request will be reviewed before it is
          scheduled.
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
      className={`rounded-lg border p-3 text-xs ${belowMinimum ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
    >
      <p className="font-medium">Minimum quantities for a collection route:</p>
      <p className="mt-1">
        This partner&apos;s guidance: {minText}.
        {minimum.guidance_text
          ? ` ${minimum.guidance_text}`
          : ' Below-minimum requests can be reviewed as exceptions; they are never silently rejected.'}
      </p>
      {belowMinimum ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-white p-3">
          <p className="text-xs font-medium text-amber-900">
            Your estimate is below the partner minimum.
          </p>
          <p className="mt-1 text-[11px] leading-4 text-[var(--color-text-secondary)]">
            We never silently reject a below-minimum request. Submit your request and include a
            short note — for example, high-value items, urgency, or a nearby pickup window — so a
            human can approve an exception.
          </p>
          {onRequestException ? (
            <button
              type="button"
              onClick={onRequestException}
              className="mt-3 inline-flex min-h-9 items-center rounded-full border border-amber-600 bg-amber-600 px-4 text-xs font-medium text-white"
            >
              Request exception
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-amber-700">
          Your estimate meets the guidance. No exception is needed.
        </p>
      )}
    </div>
  );
}

export default TextileMinimumNotice;
