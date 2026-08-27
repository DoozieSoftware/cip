export type TextileMethod = 'dropoff' | 'premises';
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
  if (status === 'scheduled')
    return method === 'dropoff'
      ? `Reference ${ctx.reference ?? ''} is valid at the counter until ${ctx.date ?? 'the scheduled date'}.`
      : `Keep bags at ${ctx.address ?? 'your address'} between ${ctx.window ?? 'the scheduled window'}. Crew photo confirms collection.`;
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
