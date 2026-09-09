/**
 * Receipt QR payload schema (issue #18 — bag tagging).
 *
 * Versioned, self-contained payload: booking ref + citizen name + actual
 * bags/kg + timestamp + trip/centre. Details ride inside the URL fragment, so
 * a normal phone camera opens a readable page while no personal details are
 * sent to the server in the HTTP request. Staff scanners can decode the same
 * fragment offline. The booking-pass QR (reference only) is untouched.
 */

export const RECEIPT_QR_VERSION = 1 as const;

export type ReceiptQrLane = 'premises' | 'dropoff';

export interface ReceiptQrPayload {
  /** Schema version — decoders must reject anything else. */
  v: typeof RECEIPT_QR_VERSION;
  /** Booking reference, e.g. DLN-2026-79FFFC75. */
  ref: string;
  /** Citizen/requester name on the booking. */
  name: string;
  /** Weighed actuals; null when not recorded. */
  bags: number | null;
  kg: number | null;
  /** Collection/receipt moment, ISO 8601. */
  at: string;
  /** Trip reference (premises) or centre name (drop-off). */
  via: string | null;
  lane: ReceiptQrLane;
}

export type ReceiptQrInput = Omit<ReceiptQrPayload, 'v'>;

export function encodeReceiptQr(input: ReceiptQrInput, origin?: string): string {
  const payload: ReceiptQrPayload = { ...input, v: RECEIPT_QR_VERSION };
  const json = JSON.stringify(payload);
  const base =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : 'https://cip.local');

  return `${base}/public/textile-receipt#${base64UrlEncode(json)}`;
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): string {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function payloadText(raw: string): string {
  const text = raw.trim();
  if (text.startsWith('{')) return text; // Backward-compatible early test labels.

  try {
    const url = new URL(text);
    if (url.pathname !== '/public/textile-receipt' || url.hash.length < 2) {
      throw new Error('wrong receipt URL');
    }
    return base64UrlDecode(url.hash.slice(1));
  } catch {
    throw new Error('This is not a bag receipt QR — it holds no collection details.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Decode a scanned receipt QR. Throws an Error with a staff-readable message
 * when the code is not a receipt QR (booking-pass QR, garbage, wrong version).
 */
export function decodeReceiptQr(raw: string): ReceiptQrPayload {
  const text = raw.trim();

  if (text === '') throw new Error('Empty code — scan a bag receipt QR.');

  let parsed: unknown;

  try {
    parsed = JSON.parse(payloadText(text));
  } catch {
    // A booking-pass QR (bare DLN- reference) lands here: valid code, wrong job.
    throw new Error('This is not a bag receipt QR — it holds no collection details.');
  }

  if (!isRecord(parsed)) throw new Error('This is not a bag receipt QR.');

  if (parsed['v'] !== RECEIPT_QR_VERSION) {
    throw new Error(
      `Unsupported receipt QR version — expected v${RECEIPT_QR_VERSION}. Reprint the receipt.`,
    );
  }

  const ref = parsed['ref'];
  const name = parsed['name'];
  const at = parsed['at'];
  const lane = parsed['lane'];

  if (typeof ref !== 'string' || ref.trim() === '') {
    throw new Error('Receipt QR has no booking reference — reprint the receipt.');
  }

  if (
    typeof name !== 'string' ||
    typeof at !== 'string' ||
    (lane !== 'premises' && lane !== 'dropoff')
  ) {
    throw new Error('Receipt QR is damaged — reprint the receipt.');
  }

  const bags = parsed['bags'];
  const kg = parsed['kg'];
  const via = parsed['via'];

  if (
    typeof bags !== 'number' ||
    !Number.isFinite(bags) ||
    bags <= 0 ||
    typeof kg !== 'number' ||
    !Number.isFinite(kg) ||
    kg <= 0
  ) {
    throw new Error('Receipt QR has no valid weighed actuals — reprint the receipt.');
  }

  return {
    v: RECEIPT_QR_VERSION,
    ref: ref.trim(),
    name,
    bags,
    kg,
    at,
    via: typeof via === 'string' && via !== '' ? via : null,
    lane,
  };
}
