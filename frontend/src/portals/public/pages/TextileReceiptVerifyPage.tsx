import { useEffect, useState, type JSX } from 'react';
import { IconAlertTriangle, IconCircleCheck, IconPackage } from '@tabler/icons-react';
import {
  decodeReceiptQr,
  type ReceiptQrPayload,
} from '../../operations/pages/textile/components/receiptQr';

export default function TextileReceiptVerifyPage(): JSX.Element {
  const [result, setResult] = useState<
    { payload: ReceiptQrPayload; error: null } | { payload: null; error: string }
  >(() => readReceipt());

  useEffect(() => {
    const refresh = () => setResult(readReceipt());
    window.addEventListener('hashchange', refresh);
    return () => window.removeEventListener('hashchange', refresh);
  }, []);

  if (result.payload === null) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <section className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <IconAlertTriangle className="mx-auto h-9 w-9 text-rose-700" aria-hidden="true" />
          <h1 className="mt-3 text-xl font-semibold text-[var(--color-ink)]">
            Unreadable bag label
          </h1>
          <p role="alert" className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {result.error}
          </p>
          <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
            Ask the collection centre to print the bag label again.
          </p>
        </section>
      </main>
    );
  }

  const receipt = result.payload;
  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-700 text-white">
              <IconPackage className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Dr. Linen bag label
              </p>
              <h1 className="font-mono text-lg font-bold tracking-wider text-slate-950">
                {receipt.ref}
              </h1>
            </div>
          </div>
        </div>

        <div className="p-5">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            <IconCircleCheck className="h-4 w-4" aria-hidden="true" />
            Receipt details found
          </p>
          <dl className="mt-5 divide-y divide-slate-100 text-sm">
            <ReceiptRow label="Citizen" value={receipt.name} />
            <ReceiptRow label="Collected" value={`${receipt.bags} bags · ${receipt.kg} kg`} />
            <ReceiptRow label="When" value={formatDate(receipt.at)} />
            <ReceiptRow
              label={receipt.lane === 'premises' ? 'Trip' : 'Centre'}
              value={receipt.via ?? 'Not recorded'}
            />
          </dl>
          <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
            These details are stored inside the bag label QR. Dr. Linen staff can additionally
            compare them with the booking record in the operations portal.
          </p>
        </div>
      </section>
    </main>
  );
}

function readReceipt():
  | { payload: ReceiptQrPayload; error: null }
  | { payload: null; error: string } {
  try {
    return { payload: decodeReceiptQr(window.location.href), error: null };
  } catch (error) {
    return {
      payload: null,
      error: error instanceof Error ? error.message : 'This bag label could not be read.',
    };
  }
}

function ReceiptRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-3 py-3">
      <dt className="text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="text-right font-semibold text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}
