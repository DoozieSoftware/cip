import { useState, type JSX } from 'react';
import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react';
import { ApiError } from '../../../../../shared/api/errors';
import { lookupTextileByReference, type TextileCollectionListItem } from '../../../api/textileApi';
import { decodeReceiptQr, type ReceiptQrPayload } from './receiptQr';
import { QrScanner } from './QrScanner';

/**
 * Bag verify (issue #18): scan or paste a bag receipt QR, decode the inline
 * details, and resolve them to the booking record. Works offline for the
 * decode step — the booking lookup needs a connection.
 */
export function VerifyBagCard({ departmentId }: { departmentId?: string }): JSX.Element {
  const [decoded, setDecoded] = useState<ReceiptQrPayload | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [booking, setBooking] = useState<TextileCollectionListItem | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  async function handleScan(raw: string): Promise<void> {
    setDecodeError(null);
    setBooking(null);
    setLookupError(null);
    let payload: ReceiptQrPayload;
    try {
      payload = decodeReceiptQr(raw);
    } catch (e) {
      setDecoded(null);
      setDecodeError(e instanceof Error ? e.message : 'Unreadable code.');
      return;
    }
    setDecoded(payload);
    setLookingUp(true);
    try {
      const found = await lookupTextileByReference(payload.ref, departmentId);
      setBooking(found);
    } catch (e) {
      setBooking(null);
      setLookupError(
        e instanceof ApiError
          ? `No booking found for ${payload.ref} — the code details below are still valid offline.`
          : 'Booking lookup failed — the code details below are still valid offline.',
      );
    } finally {
      setLookingUp(false);
    }
  }

  const nameMatches =
    decoded !== null &&
    booking !== null &&
    decoded.name.trim().toLowerCase() === booking.requester_name.trim().toLowerCase();
  const bagsMatch =
    decoded !== null &&
    booking !== null &&
    booking.actual_bags !== null &&
    decoded.bags === booking.actual_bags;
  const kgMatch =
    decoded !== null &&
    booking !== null &&
    booking.actual_weight_kg !== null &&
    decoded.kg === booking.actual_weight_kg;
  const statusMatches =
    booking !== null && (booking.status === 'picked_up' || booking.status === 'received_at_centre');

  return (
    <section
      aria-label="Verify a tagged bag"
      className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold tracking-tight text-[var(--color-ink)]">
        Verify a tagged bag
      </h2>
      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
        Scan the bag receipt QR to check whose bag it is and when it was collected.
      </p>
      <div className="mt-3">
        <QrScanner onScan={(raw) => void handleScan(raw)} />
      </div>

      {decodeError ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
        >
          {decodeError}
        </p>
      ) : null}

      {decoded ? (
        <div className="mt-3 space-y-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)]/50 p-3 text-xs">
          <p className="font-mono text-sm font-bold text-[var(--color-ink)]">{decoded.ref}</p>
          <p className="text-[var(--color-text-secondary)]">
            {decoded.name} · {decoded.bags ?? '—'} bags · {decoded.kg ?? '—'} kg
          </p>
          <p className="text-[var(--color-text-tertiary)]">
            {decoded.lane === 'premises' ? 'Trip' : 'Centre'}: {decoded.via ?? '—'}
          </p>
          {lookingUp ? (
            <p className="text-[var(--color-text-secondary)]">Resolving booking…</p>
          ) : null}
          {lookupError ? (
            <p role="status" className="text-[var(--color-warning)]">
              {lookupError}
            </p>
          ) : null}
          {booking ? (
            <ul className="space-y-1 border-t border-[var(--color-border-subtle)] pt-2">
              <VerifyRow
                ok={statusMatches}
                label={`Booking ${booking.reference} · ${booking.status.replaceAll('_', ' ')}`}
              />
              <VerifyRow ok={nameMatches} label="Citizen name matches booking" />
              <VerifyRow ok={bagsMatch} label="Bag count matches weigh record" />
              <VerifyRow ok={kgMatch} label="Weight matches weigh record" />
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function VerifyRow({ ok, label }: { ok: boolean; label: string }): JSX.Element {
  return (
    <li className="flex items-center gap-1.5">
      {ok ? (
        <IconCircleCheck
          className="h-3.5 w-3.5 shrink-0 text-[var(--color-success)]"
          aria-label="match"
        />
      ) : (
        <IconAlertTriangle
          className="h-3.5 w-3.5 shrink-0 text-[var(--color-warning)]"
          aria-label="mismatch"
        />
      )}
      <span className={ok ? 'text-[var(--color-text-secondary)]' : 'font-medium text-amber-800'}>
        {label}
        {ok ? '' : ' — check before shelving'}
      </span>
    </li>
  );
}
