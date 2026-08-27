/* eslint-disable @typescript-eslint/no-redundant-type-constituents -- string fallback intentionally broadens known trip states */
export type TextileMethod = 'dropoff' | 'premises';
export type TextileTripStatus =
  | 'planned'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | string;
/**
 * Phase 3: human-readable explanation for why rescheduling is blocked or requires fallback.
 */
export function rescheduleBlockedReason(tripStatus: string | null | undefined): string | null {
  if (tripStatus === 'in_progress') return 'Crew is already on the route — rescheduling is paused. Contact support for help.';
  if (tripStatus === 'completed') return 'This trip is already completed and cannot be rescheduled.';
  return null;
}
export function unavailableCopy(unavailableDates: string[], nextAvailable: string | null): string {
  if (unavailableDates.length === 0) return 'Pickups are available on upcoming dates.';
  const base = `No pickup on ${unavailableDates.slice(0, 3).join(', ')}${unavailableDates.length > 3 ? ` and ${unavailableDates.length - 3} more` : ''}.`;
  return nextAvailable ? `${base} Next available: ${nextAvailable}.` : base;
}
export function slotUnavailableFallback(method: TextileMethod): string {
  return method === 'premises'
    ? 'That slot is no longer available. Pick another date, or drop bags at the centre instead — no slot needed.'
    : 'That centre slot is full. Try another date or contact support.';
}
export function tripStatusLabel(tripStatus: string | null | undefined): string | null {
  if (!tripStatus) return null;
  const map: Record<string, string> = {
    planned: 'Scheduled',
    assigned: 'Scheduled',
    in_progress: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[tripStatus] ?? tripStatus;
}
export function statusHeading(status: string, method: TextileMethod): string {
  const dropoff: Record<string, string> = {
    pending_review: 'Drop-off request created',
    ready_to_group: 'Approved — ready to drop off',
    scheduled: 'Drop-off pass is active',
    picked_up: 'Received at the centre — thank you',
    missed: 'Drop-off pass expired',
    rejected: 'Request not accepted',
    cancelled: 'Cancelled',
  };
  const pickup: Record<string, string> = {
    pending_review: 'Request sent for review',
    ready_to_group: 'Approved — waiting for a route day',
    scheduled: 'Pickup scheduled',
    picked_up: 'Collected — thank you',
    missed: 'We missed this pickup',
    rejected: 'Request not accepted',
    cancelled: 'Cancelled',
  };
  return (method === 'dropoff' ? dropoff : pickup)[status] ?? status;
}
export function nextStepCopy(
  status: string,
  method: TextileMethod,
  ctx: {
    centre?: string;
    reference?: string;
    address?: string;
    window?: string;
    date?: string;
    actual?: string;
    tripStatus?: string | null;
  },
): string {
  if (status === 'pending_review')
    return method === 'dropoff'
      ? 'You do not need to wait — you can take items to the centre below any time it is open.'
      : 'Dr. Linen reviews this in 1–2 working days. Keep bags packed and dry.';
  if (status === 'ready_to_group')
    return method === 'dropoff'
      ? `Bring your bags to ${ctx.centre ?? 'the centre'}. Show reference ${ctx.reference ?? ''} at the counter.`
      : "We are grouping nearby collections. You'll get a pickup date soon.";
  if (status === 'scheduled') {
    if (method === 'dropoff')
      return `Reference ${ctx.reference ?? ''} is valid at the counter until ${ctx.date ?? 'the scheduled date'}.`;
    if (ctx.tripStatus === 'in_progress')
      return `Crew is on the route today — keep bags at ${ctx.address ?? 'your address'} between ${ctx.window ?? 'the scheduled window'}.`;
    return `Keep bags at ${ctx.address ?? 'your address'} between ${ctx.window ?? 'the scheduled window'}. Crew photo confirms collection.`;
  }
  if (status === 'picked_up')
    return method === 'dropoff'
      ? `The centre logged your drop-off. We counted ${ctx.actual ?? 'your items'}.`
      : `Proof photo is below. We counted ${ctx.actual ?? 'your items'}.`;
  if (status === 'missed')
    return `You can rebook a new request or drop off at ${ctx.centre ?? 'the centre'} now.`;
  if (status === 'rejected') return 'You can still drop these items off at the centre.';
  if (status === 'cancelled') return 'This request is closed and cannot be reopened.';
  return '';
}
