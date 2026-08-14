import { useState, type JSX } from 'react';
import { useSecurityPolicies, useUpsertSecurityPolicy, type SecurityPolicy } from '../api/client';
import {
  Spinner,
  EmptyState,
  ErrorState,
  Dialog,
  Button,
  Card,
  Table,
  TR,
  TH,
  TD,
} from '../../../shared/ui';
import { IconPencil } from '@tabler/icons-react';

export default function AdminSecurityPolicies(): JSX.Element {
  const list = useSecurityPolicies();
  const upsert = useUpsertSecurityPolicy();
  const [editing, setEditing] = useState<SecurityPolicy | null>(null);
  const [draftValue, setDraftValue] = useState<string>('');

  function startEdit(p: SecurityPolicy): void {
    setEditing(p);
    setDraftValue(JSON.stringify(p.value ?? {}, null, 2));
  }

  async function save(): Promise<void> {
    if (editing === null) return;
    let parsed: Record<string, unknown>;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      parsed = JSON.parse(draftValue);
    } catch {
      alert('Value must be valid JSON.');
      return;
    }
    try {
      await upsert.mutateAsync({
        key: editing.key,
        value: parsed,
        type: editing.type,
        description: editing.description ?? '',
      });
      setEditing(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
            Security policies
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Database-driven knobs the platform reads at runtime.
          </p>
        </div>
      </header>

      <Card>
        {list.isLoading ? (
          <div className="flex justify-center py-12" aria-live="polite">
            <Spinner label="Loading policies" />
          </div>
        ) : list.isError ? (
          <ErrorState title="Failed to load policies" error={list.error} />
        ) : (list.data ?? []).length === 0 ? (
          <EmptyState
            title="No policies"
            description="Run database/seeders/DatabaseSeeder to install the defaults."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[36rem] ring-[var(--color-border-subtle)]">
              <thead className="bg-[var(--color-canvas)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                <tr>
                  <TH>Key</TH>
                  <TH>Value</TH>
                  <TH>Type</TH>
                  <TH className="text-right">Action</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {(list.data ?? []).map((p: SecurityPolicy) => (
                  <TR key={p.id}>
                    <TD className="font-mono text-xs text-[var(--color-ink)]">{p.key}</TD>
                    <TD className="font-mono text-xs text-[var(--color-text-secondary)]">
                      {JSON.stringify(p.value)}
                    </TD>
                    <TD className="text-xs text-[var(--color-text-secondary)]">{p.type}</TD>
                    <TD className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<IconPencil className="h-3.5 w-3.5" stroke={1.6} />}
                        onClick={() => startEdit(p)}
                      >
                        Edit
                      </Button>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.key ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={upsert.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={upsert.isPending}
              onClick={() => {
                void save();
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <p className="text-xs text-[var(--color-text-secondary)]">
          JSON value, e.g. {`{"min": 8}`}
        </p>
        <textarea
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          rows={8}
          className="mt-3 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 font-mono text-xs focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
        />
      </Dialog>
    </div>
  );
}
