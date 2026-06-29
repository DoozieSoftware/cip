import { useState } from 'react';
import { Dialog, Button, Textarea, Select, Input } from '../design';

export interface AssignmentResult {
  assignee_id: string;
  reason: string;
}

export function AssignmentDialog({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (r: AssignmentResult) => void;
  loading: boolean;
}) {
  const [assigneeId, setAssigneeId] = useState('');
  const [reason, setReason] = useState('');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Reassign report"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={!assigneeId || !reason.trim()}
            onClick={() => onSubmit({ assignee_id: assigneeId, reason: reason.trim() })}
          >
            Reassign
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="Assignee user id"
          name="assignee_id"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          placeholder="UUID of a department officer"
          hint="T-M10-019: this hands off to the M7 ReassignService. Type a UUID or pick from the directory."
        />
        <Select
          label="Reason"
          name="reason_code"
          value=""
          onChange={() => undefined}
          options={[
            { value: '', label: '— pick a reason —' },
            { value: 'workload', label: 'Workload rebalance' },
            { value: 'expertise', label: 'Subject-matter expertise' },
            { value: 'escalation', label: 'Escalation follow-up' },
          ]}
        />
        <Textarea
          label="Notes"
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Why is this report being reassigned?"
        />
      </div>
    </Dialog>
  );
}
