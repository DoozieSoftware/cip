import { useState } from 'react';
import { Button, Dialog, Input, Textarea } from '../design';

/**
 * Sticky bulk-action toolbar (T-M10-022). Lets a moderator select N
 * reports in the queue and apply the same decision to all of them.
 *
 * Selection state lives in the parent (e.g. ReviewQueuePage) and the
 * caller passes the selected ids + a callback to execute the action.
 */
export interface BulkAction {
  type: 'approve' | 'reject' | 'merge';
  reason_code?: string;
  remarks?: string;
  canonical_id?: string;
}

export function BulkActionsBar({
  count,
  onApply,
  loading,
}: {
  count: number;
  onApply: (a: BulkAction) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<BulkAction['type']>('reject');
  const [reason, setReason] = useState('');
  const [canonical, setCanonical] = useState('');
  const [remarks, setRemarks] = useState('');

  if (count === 0) return null;

  return (
    <>
      <div
        role="region"
        aria-label="Bulk actions"
        className="sticky bottom-4 z-20 mx-auto flex w-fit items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
      >
        <span>{count} selected</span>
        <Button size="sm" variant="secondary" onClick={() => { setType('approve'); setOpen(true); }}>
          Bulk approve
        </Button>
        <Button size="sm" variant="danger" onClick={() => { setType('reject'); setOpen(true); }}>
          Bulk reject
        </Button>
        <Button size="sm" variant="secondary" onClick={() => { setType('merge'); setOpen(true); }}>
          Bulk merge
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Bulk ${type}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant={type === 'reject' ? 'danger' : 'primary'}
              loading={loading}
              onClick={() => {
                onApply({ type, reason_code: reason || undefined, remarks: remarks || undefined, canonical_id: canonical || undefined });
                setOpen(false);
              }}
            >
              Apply to {count} reports
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {type === 'merge' && (
            <Input
              label="Canonical report id (UUID)"
              name="canonical_id"
              value={canonical}
              onChange={(e) => setCanonical(e.target.value)}
            />
          )}
          {type === 'reject' && (
            <Input
              label="Reason code"
              name="reason_code"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. duplicate"
            />
          )}
          <Textarea
            label="Remarks (optional)"
            name="remarks"
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </Dialog>
    </>
  );
}
