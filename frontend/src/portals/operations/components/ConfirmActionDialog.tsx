import { useEffect, useState } from 'react';
import { Button, Dialog, Textarea } from '../../../shared/ui';

/**
 * Confirmation step for a workflow action. Workflow transitions must be
 * deliberate, so every action opens this dialog before anything is
 * sent to the API. Actions that change the report's outcome
 * ('progress' / 'resolve' / 'close') REQUIRE a note: the confirm
 * button stays disabled until the textarea is non-empty, and the note
 * is passed through to the action endpoint.
 */
export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = 'primary',
  requiresNote = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger' | 'success';
  requiresNote?: boolean;
  busy?: boolean;
  onConfirm: (note?: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) setNote('');
  }, [open]);

  const canConfirm = !requiresNote || note.trim() !== '';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            loading={busy}
            disabled={!canConfirm}
            onClick={() => onConfirm(note.trim() || undefined)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {description && <p className="text-sm text-slate-600">{description}</p>}
        {requiresNote && (
          <Textarea
            label="Note (required)"
            name="action-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Required — recorded in the report timeline and audit trail."
          />
        )}
      </div>
    </Dialog>
  );
}
