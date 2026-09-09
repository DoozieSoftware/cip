import { describe, expect, it } from 'vitest';
import {
  RECEIPT_QR_VERSION,
  decodeReceiptQr,
  encodeReceiptQr,
  type ReceiptQrInput,
} from './receiptQr';

const PREMISES: ReceiptQrInput = {
  ref: 'DLN-2026-79FFFC75',
  name: 'Lakshmi Devi',
  bags: 4,
  kg: 11,
  at: '2026-09-09T10:30:00+05:30',
  via: 'DRL-260909-XX11TO',
  lane: 'premises',
};

describe('receiptQr', () => {
  it('round-trips a premises receipt payload', () => {
    expect(decodeReceiptQr(encodeReceiptQr(PREMISES))).toEqual({
      ...PREMISES,
      v: RECEIPT_QR_VERSION,
    });
  });

  it('round-trips a drop-off receipt payload with a centre handoff', () => {
    const input: ReceiptQrInput = {
      ref: 'DLN-2026-81AAAB12',
      name: 'Ravi Kumar',
      bags: 2,
      kg: 5,
      at: '2026-09-09T11:00:00+05:30',
      via: 'Jayanagar Centre',
      lane: 'dropoff',
    };

    expect(decodeReceiptQr(encodeReceiptQr(input))).toEqual({
      ...input,
      v: RECEIPT_QR_VERSION,
    });
  });

  it('opens a public page while keeping details in the URL fragment', () => {
    const encoded = encodeReceiptQr(PREMISES, 'https://cip.example.test');

    expect(encoded).toMatch(/^https:\/\/cip\.example\.test\/public\/textile-receipt#/);
    expect(decodeReceiptQr(encoded)).toMatchObject(PREMISES);
    // Fragment data is not sent to the web server in an HTTP request.
    expect(encoded.split('#')[0]).not.toContain('Lakshmi');
  });

  it('rejects a booking-pass QR (bare reference, no details)', () => {
    expect(() => decodeReceiptQr('DLN-2026-79FFFC75')).toThrow(/not a bag receipt QR/);
  });

  it('rejects garbage scans with a staff-readable message', () => {
    expect(() => decodeReceiptQr('   ')).toThrow(/Empty code/);
    expect(() => decodeReceiptQr('not-json-at-all{{{')).toThrow(/not a bag receipt QR/);
    expect(() => decodeReceiptQr('[1,2,3]')).toThrow(/not a bag receipt QR/);
  });

  it('rejects unknown schema versions instead of misreading them', () => {
    const future = JSON.stringify({ ...PREMISES, v: 99 });

    expect(() => decodeReceiptQr(future)).toThrow(/Unsupported receipt QR version/);
  });

  it('rejects payloads missing the booking reference', () => {
    const noRef = JSON.stringify({ v: 1, name: 'X', at: '2026-09-09', lane: 'premises' });

    expect(() => decodeReceiptQr(noRef)).toThrow(/no booking reference/);
  });

  it('rejects missing or non-numeric actuals', () => {
    const payload = JSON.stringify({ ...PREMISES, v: 1, bags: 'four', kg: null });

    expect(() => decodeReceiptQr(payload)).toThrow(/no valid weighed actuals/);
  });
});
