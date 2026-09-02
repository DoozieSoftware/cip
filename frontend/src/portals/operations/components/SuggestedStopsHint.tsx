import { useMemo, useState, type JSX } from 'react';
import { IconArrowsSort, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import type { TextileCollectionListItem } from '../api/textileApi';

export function SuggestedStopsHint({
  suggestedOrder,
  currentOrder,
  items,
  note,
  onApply,
  className,
}: {
  suggestedOrder: string[];
  currentOrder?: string[];
  items: TextileCollectionListItem[];
  note?: string;
  onApply?: () => void;
  className?: string;
}): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const byId = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);
  const isAlreadyOptimal = useMemo(() => {
    if (!currentOrder || !suggestedOrder) return false;
    return (
      suggestedOrder.length === currentOrder.length &&
      suggestedOrder.every((id, idx) => id === currentOrder[idx])
    );
  }, [currentOrder, suggestedOrder]);
  const movedCount = useMemo(() => {
    if (!currentOrder || isAlreadyOptimal || !suggestedOrder) return 0;
    let c = 0;
    for (let i = 0; i < suggestedOrder.length; i++) if (suggestedOrder[i] !== currentOrder[i]) c++;
    return c;
  }, [currentOrder, isAlreadyOptimal, suggestedOrder]);

  if (!suggestedOrder || suggestedOrder.length === 0) return null;
  if (items.length <= 1) return null;

  // Don't show a hero banner — compact advisory row inside trip header
  return (
    <div
      className={`rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)]/60 ${className ?? ''}`}
    >
      <div className="flex flex-wrap items-center gap-2 px-2.5 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] leading-none text-[var(--color-text-secondary)]">
          <IconArrowsSort
            className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]"
            stroke={1.65}
          />
          {isAlreadyOptimal ? (
            <>
              <span className="font-medium text-[var(--color-ink)]">Route optimized</span>
              <span className="hidden sm:inline opacity-70">· Already in best order</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-emerald-700">
                Optimized
              </span>
            </>
          ) : (
            <>
              <span className="font-medium text-[var(--color-ink)]">Recommended route</span>
              <span className="hidden sm:inline opacity-70">· Stops ordered to reduce travel</span>
              {movedCount > 0 ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-800">
                  {movedCount} reordered
                </span>
              ) : null}
            </>
          )}
        </span>
        <span className="ml-auto inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex h-6 items-center gap-1 rounded-full border border-[var(--color-border)] bg-white px-2.5 text-[11px] font-medium leading-none hover:bg-[var(--color-surface-alt)]"
          >
            {open ? (
              <IconChevronUp className="h-3 w-3" stroke={1.65} />
            ) : (
              <IconChevronDown className="h-3 w-3" stroke={1.65} />
            )}
            {open ? 'Hide' : 'See route'}
          </button>
          {onApply ? (
            <button
              type="button"
              onClick={onApply}
              className="inline-flex h-6 items-center rounded-full bg-[var(--color-ink)] px-3 text-[11px] font-medium text-white"
            >
              Apply
            </button>
          ) : null}
        </span>
      </div>
      {note && !open ? <p className="sr-only">{note}</p> : null}
      {open ? (
        <div className="border-t border-[var(--color-border-subtle)] bg-white px-2.5 py-2">
          <ol className="space-y-1">
            {suggestedOrder.map((id, idx) => {
              const it = byId.get(id);
              if (!it) return null;
              const currentIdx = currentOrder ? currentOrder.indexOf(id) : -1;
              const moved = currentIdx !== -1 && currentIdx !== idx;
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-[10px] font-bold text-white">
                    {idx + 1}
                  </span>
                  <span className="font-mono text-[11px]">{it.reference}</span>
                  <span className="min-w-0 flex-1 truncate text-[var(--color-text-secondary)]">
                    {it.pickup_address}
                  </span>
                  {moved ? (
                    <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      moved
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <p className="mt-1.5 text-[11px] leading-3 text-[var(--color-text-tertiary)]">
            {note ??
              'Nearby addresses grouped to shorten drive. Advisory only — confirm before driving.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
