import type {
  TextileCapacityEvaluation,
  TextileCapacityRule,
  TextileCollectionListItem,
} from '../../api/textileApi';

/** Routes for the split schedule flow: queue (Trips) + dedicated new-trip page. */
export const SCHEDULE_PATH = '/operations/textile-collections/schedule';
export const TRIP_NEW_PATH = '/operations/textile-collections/schedule/new';

/** Selection carried from the Trips queue to the new-trip page via router state. */
export interface ScheduleTripLocationState {
  selectedIds: string[];
  manifestOrder?: string[];
}

export function readTripLocationState(state: unknown): ScheduleTripLocationState | null {
  if (!state || typeof state !== 'object') return null;
  const ids = (state as { selectedIds?: unknown }).selectedIds;
  if (!Array.isArray(ids) || !ids.every((id): id is string => typeof id === 'string')) return null;
  const manifestOrder = (state as { manifestOrder?: unknown }).manifestOrder;
  return {
    selectedIds: ids,
    manifestOrder:
      Array.isArray(manifestOrder) &&
      manifestOrder.every((id): id is string => typeof id === 'string')
        ? manifestOrder
        : undefined,
  };
}

// Quick pickup windows (24h values for the API). Tapping a chip fills both time
// fields; the native time inputs below stay as the custom override.
export const WINDOW_PRESETS = [
  { label: '09:00–12:00', start: '09:00', end: '12:00' },
  { label: '12:00–15:00', start: '12:00', end: '15:00' },
  { label: '15:00–18:00', start: '15:00', end: '18:00' },
] as const;

// Shared field input — single source for date/time + driver/team/vehicle/ref/instructions
// (rounded-lg per spec, token border, focus ring). Keeps ops desk consistent.
export const FIELD_INPUT =
  'mt-1 block min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 focus-visible:border-[var(--color-border-strong)]';
export const FIELD_TEXTAREA =
  'mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 focus-visible:border-[var(--color-border-strong)]';

export function buildProspectiveEvaluation(
  items: TextileCollectionListItem[],
  rule: TextileCapacityRule | null,
): TextileCapacityEvaluation {
  const totalBags = items.reduce((s, r) => s + (r.estimated_bags ?? 0), 0);
  const totalWeight = items.reduce((s, r) => s + (r.estimated_weight_kg ?? 0), 0);
  const stops = items.length;
  const categories = new Set(items.map((r) => r.category).filter(Boolean));

  const warnings: TextileCapacityEvaluation['warnings'] = [];
  const blockers: TextileCapacityEvaluation['blockers'] = [];

  if (rule) {
    if (rule.max_bags !== null && totalBags > rule.max_bags) {
      blockers.push({
        code: 'exceeds_max_bags',
        message: `Trip has ${totalBags} bags but zone limit is ${rule.max_bags} bags for this day. Remove stops or split the trip.`,
      });
    } else if (rule.max_bags !== null && totalBags >= Math.ceil(rule.max_bags * 0.85)) {
      warnings.push({
        code: 'near_max_bags',
        message: `Trip has ${totalBags} bags — near the zone limit of ${rule.max_bags} bags (${Math.round((totalBags / rule.max_bags) * 100)}% of capacity).`,
        severity: 'amber',
      });
    }

    if (rule.max_weight_kg !== null && totalWeight > rule.max_weight_kg) {
      blockers.push({
        code: 'exceeds_max_weight',
        message: `Trip weight ${totalWeight.toFixed(1)} kg exceeds zone limit ${rule.max_weight_kg} kg. Adjust the load or split the trip.`,
      });
    } else if (rule.max_weight_kg !== null && totalWeight >= rule.max_weight_kg * 0.85) {
      warnings.push({
        code: 'near_max_weight',
        message: `Trip weight ${totalWeight.toFixed(1)} kg is near the zone limit ${rule.max_weight_kg} kg.`,
        severity: 'amber',
      });
    }

    if (rule.max_stops !== null && stops > rule.max_stops) {
      blockers.push({
        code: 'exceeds_max_stops',
        message: `Trip has ${stops} stops but limit is ${rule.max_stops}. Split the trip.`,
      });
    }

    if (Array.isArray(rule.category_allowlist) && rule.category_allowlist.length > 0) {
      const allowed = rule.category_allowlist.filter((c): c is string => typeof c === 'string');
      const incompatible = [...categories].filter((cat) => !allowed.includes(cat));
      if (incompatible.length > 0) {
        blockers.push({
          code: 'incompatible_category',
          message: `Trip mixes categories not allowed together for this zone: ${incompatible.join(', ')}. Review vehicle/material requirements.`,
        });
      }
    }

    const hasBagEstimate = items.some((item) => item.estimated_bags !== null);
    const hasWeightEstimate = items.some((item) => item.estimated_weight_kg !== null);
    const minimumChecks = [
      rule.min_bags !== null && hasBagEstimate ? totalBags >= rule.min_bags : null,
      rule.min_weight_kg !== null && hasWeightEstimate ? totalWeight >= rule.min_weight_kg : null,
    ].filter((check): check is boolean => check !== null);
    if (minimumChecks.length > 0 && !minimumChecks.some(Boolean)) {
      const parts: string[] = [];
      if (rule.min_bags !== null && hasBagEstimate)
        parts.push(`${totalBags} bags below minimum ${rule.min_bags}`);
      if (rule.min_weight_kg !== null && hasWeightEstimate)
        parts.push(`${totalWeight.toFixed(1)} kg below minimum ${rule.min_weight_kg} kg`);
      const guidance = rule.guidance_text ? ` ${rule.guidance_text}` : '';
      blockers.push({
        code: 'below_minimum',
        message: `Trip is ${parts.join(' and ')}.${guidance}`,
      });
    }
  }

  return {
    ok: blockers.length === 0,
    warnings,
    blockers,
    totals: { bags: totalBags, weight_kg: Number(totalWeight.toFixed(2)), stops },
    effective_rule: rule
      ? {
          id: rule.id,
          max_bags: rule.max_bags,
          max_weight_kg: rule.max_weight_kg,
          max_stops: rule.max_stops,
          min_bags: rule.min_bags,
          min_weight_kg: rule.min_weight_kg,
          guidance_text: rule.guidance_text,
          category_allowlist: rule.category_allowlist,
        }
      : null,
    suggested_order: [],
  };
}
