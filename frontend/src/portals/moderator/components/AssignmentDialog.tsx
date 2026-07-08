import { useState } from 'react';
import { Dialog, Button, Textarea, Input } from '../design';

export interface AssignmentResult {
  department_id: string;
  officer_id?: string;
  reason: string;
}

export function AssignmentDialog({
  open,
  onClose,
  onSubmit,
  loading,
  defaultDepartmentId,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (r: AssignmentResult) => void;
  loading: boolean;
  defaultDepartmentId?: string;
}) {
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId ?? '');
  const [officerId, setOfficerId] = useState('');
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
            disabled={!departmentId.trim() || !reason.trim()}
            onClick={() =>
              onSubmit({
                department_id: departmentId.trim(),
                officer_id: officerId.trim() || undefined,
                reason: reason.trim(),
              })
            }
          >
            Reassign
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="Department id (UUID)"
          name="department_id"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          placeholder="Required — the department this report is handed to"
        />
        <Input
          label="Officer user id (optional)"
          name="officer_id"
          value={officerId}
          onChange={(e) => setOfficerId(e.target.value)}
          placeholder="UUID of a specific officer within the department"
        />
        <Textarea
          label="Reason"
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Why is this report being reassigned? (required, min 3 characters)"
        />
      </div>
    </Dialog>
  );
}
