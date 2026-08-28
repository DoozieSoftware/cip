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

  if (!suggestedOrder || suggestedOrder.length === 0) return null;

  const isAlreadyOptimal =
    currentOrder &&
    suggestedOrder.length === currentOrder.length &&
    suggestedOrder.every((id, idx) => id === currentOrder[idx]);

  if (items.length === 0) return null;

  return (
    <div className={`rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-900">
          <IconArrowsSort className="h-4 w-4" />
          Suggested stop order
          {isAlreadyOptimal ? (
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-sky-700">
              Already optimal
            </span>
          ) : null}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-medium text-sky-800">
          {open ? (
            <IconChevronUp className="h-3.5 w-3.5" />
          ) : (
            <IconChevronDown className="h-3.5 w-3.5" />
          )}
          {open ? 'Hide' : 'Show'}
        </span>
      </button>
      <p className="mt-1 text-[11px] leading-4 text-sky-700">
        {note ??
          'Suggested ordering groups nearby stops to shorten the route. Staff must confirm before scheduling.'}
      </p>
      {open ? (
        <div className="mt-3 space-y-2">
          <ol className="space-y-1">
            {suggestedOrder.map((id, idx) => {
              const it = byId.get(id);
              if (!it) return null;
              const currentIdx = currentOrder ? currentOrder.indexOf(id) : -1;
              const moved = currentIdx !== -1 && currentIdx !== idx;
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-lg border border-sky-100 bg-white px-3 py-2 text-xs"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-[11px] text-white">
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
          {onApply ? (
            <button
              type="button"
              onClick={onApply}
              className="min-h-9 rounded-full bg-sky-900 px-4 text-xs font-medium text-white"
            >
              Apply suggested order
            </button>
          ) : null}
          <p className="text-[11px] text-sky-700">
            Ordering is advisory — confirm the manifest before you schedule the trip.
          </p>
        </div>
      ) : null}
    </div>
  );
}
