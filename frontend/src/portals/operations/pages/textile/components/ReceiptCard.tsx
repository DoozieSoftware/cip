import { useEffect, useRef, type JSX } from 'react';
import { IconPrinter } from '@tabler/icons-react';
import QRCode from 'qrcode';
import { encodeReceiptQr, type ReceiptQrInput } from './receiptQr';
import './ReceiptCard.css';

/**
 * Printable bag receipt (issue #18): citizen name, DLN- reference, weighed
 * actuals, timestamp and trip/centre, plus the receipt QR encoding the same
 * details inline for offline warehouse scans. Rendered after Collect (driver)
 * and after Confirm receipt (counter). Print scopes to this card via CSS.
 */
export function ReceiptCard({
  receipt,
  printAreaId = 'receipt-print-area',
}: {
  receipt: ReceiptQrInput;
  printAreaId?: string;
}): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const encoded = encodeReceiptQr(receipt);

  useEffect(() => {
    if (!canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, encoded, { width: 160, margin: 1 });
  }, [encoded]);

  const collectedAt = formatReceiptDate(receipt.at);

  return (
    <section aria-label="Bag receipt" className="rounded-xl border border-slate-200 bg-white">
      <div id={printAreaId} className="p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Bag label · receipt QR
        </p>
        <p className="mt-1 font-mono text-lg font-bold tracking-widest text-slate-900">
          {receipt.ref}
        </p>
        <dl className="mt-3 space-y-1.5 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Citizen</dt>
            <dd className="font-semibold text-slate-900">{receipt.name}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Collected</dt>
            <dd className="font-semibold text-slate-900">
              {receipt.bags ?? '—'} bags · {receipt.kg ?? '—'} kg
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">When</dt>
            <dd className="font-semibold text-slate-900">{collectedAt}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">{receipt.lane === 'premises' ? 'Trip' : 'Centre'}</dt>
            <dd className="font-semibold text-slate-900">{receipt.via ?? '—'}</dd>
          </div>
        </dl>
        <div className="mt-3 flex justify-center">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Bag receipt QR for ${receipt.ref}`}
            className="rounded border border-slate-200"
          />
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-500">
          Scan this code later to verify whose bag this is and when it was collected — no network
          needed.
        </p>
      </div>
      <div className="flex gap-2 border-t border-slate-100 p-3 no-print">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1"
        >
          <IconPrinter className="h-4 w-4" aria-hidden="true" />
          Print bag label
        </button>
      </div>
    </section>
  );
}

function formatReceiptDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}
