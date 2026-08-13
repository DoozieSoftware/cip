import { useState } from 'react';
import { Button, Dialog, Select, Textarea } from '../../../shared/ui';

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

interface BulkReportOption {
  id: string;
  tracking_number: string;
  title: string;
}

const REJECT_REASONS = [
  { value: 'invalid_evidence', label: 'Invalid evidence' },
  { value: 'duplicate', label: 'Duplicate of another report' },
  { value: 'fraudulent', label: 'Misrepresentation' },
  { value: 'out_of_scope', label: 'Out of platform scope' },
  { value: 'incomplete', label: 'Incomplete information' },
];

export function BulkActionsBar({
  reports,
  onApply,
  loading,
}: {
  reports: BulkReportOption[];
  onApply: (a: BulkAction) => void;
  loading: boolean;
}) {
  const count = reports.length;
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
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setType('approve');
            setOpen(true);
          }}
        >
          Bulk approve
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            setType('reject');
            setOpen(true);
          }}
        >
          Bulk reject
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setType('merge');
            setOpen(true);
          }}
        >
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
              disabled={(type === 'merge' && !canonical) || (type === 'reject' && !reason)}
              className="disabled:text-white"
              onClick={() => {
                onApply({
                  type,
                  reason_code: reason || undefined,
                  remarks: remarks || undefined,
                  canonical_id: canonical || undefined,
                });
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
            <Select
              label="Canonical report"
              name="canonical_id"
              value={canonical}
              onChange={(e) => setCanonical(e.target.value)}
              options={[
                { value: '', label: 'Select the canonical report' },
                ...reports.map((report) => ({
                  value: report.id,
                  label: `${report.tracking_number} — ${report.title}`,
                })),
              ]}
            />
          )}
          {type === 'reject' && (
            <Select
              label="Reason"
              name="reason_code"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              options={[{ value: '', label: 'Select a reason' }, ...REJECT_REASONS]}
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
