import type { JSX } from 'react';

export function ReceiptCard({
  reference,
  date,
  actual,
  centre,
  proofUrl,
}: {
  reference: string;
  date: string;
  actual: string;
  centre: string;
  proofUrl?: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-5 print:border-black">
      <h2 className="text-sm font-medium">Drop-off receipt</h2>
      <dl className="mt-3 grid gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-[var(--color-text-secondary)]">Reference</dt>
          <dd className="font-mono font-medium">{reference}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--color-text-secondary)]">Date</dt>
          <dd>{date}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--color-text-secondary)]">Counted</dt>
          <dd>{actual}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--color-text-secondary)]">Centre</dt>
          <dd>{centre}</dd>
        </div>
      </dl>
      {proofUrl ? (
        <a href={proofUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={proofUrl}
            alt="Receipt proof"
            className="mt-3 h-48 w-full rounded-lg border object-cover"
          />
        </a>
      ) : null}
      <button
        type="button"
        onClick={() => window.print()}
        className="mt-3 inline-flex min-h-11 items-center rounded-full border border-black/15 px-4 text-sm font-medium print:hidden"
      >
        Print / Save
      </button>
    </div>
  );
}
