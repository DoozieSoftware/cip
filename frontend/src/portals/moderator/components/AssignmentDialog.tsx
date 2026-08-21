import { useState } from 'react';
import { Dialog, Button, Textarea, Select } from '../../../shared/ui';

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
  departments,
  departmentsLoading = false,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (r: AssignmentResult) => void;
  loading: boolean;
  defaultDepartmentId?: string;
  departments: Array<{ value: string; label: string }>;
  departmentsLoading?: boolean;
}) {
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId ?? '');
  const [reason, setReason] = useState('');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Reassign complaint"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={departmentsLoading || !departmentId.trim() || !reason.trim()}
            onClick={() =>
              onSubmit({
                department_id: departmentId.trim(),
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
        <Select
          label="Department"
          name="department_id"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          disabled={departmentsLoading}
          options={[
            {
              value: '',
              label: departmentsLoading ? 'Loading departments…' : 'Select a department',
            },
            ...departments,
          ]}
        />
        <Textarea
          label="Reason"
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Why is this complaint being reassigned? (required, min 3 characters)"
        />
      </div>
    </Dialog>
  );
}
