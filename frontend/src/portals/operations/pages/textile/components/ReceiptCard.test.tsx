import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import QRCode from 'qrcode';
import { ReceiptCard } from './ReceiptCard';
import { decodeReceiptQr } from './receiptQr';

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));

describe('ReceiptCard', () => {
  it('renders the receipt details and encodes them into the QR', () => {
    render(
      <ReceiptCard
        receipt={{
          ref: 'DLN-2026-79FFFC75',
          name: 'Lakshmi Devi',
          bags: 4,
          kg: 11,
          at: '2026-09-09T10:30:00+05:30',
          via: 'DRL-260909-XX11TO',
          lane: 'premises',
        }}
      />,
    );

    expect(screen.getByText('DLN-2026-79FFFC75')).toBeVisible();
    expect(screen.getByText('Lakshmi Devi')).toBeVisible();
    expect(screen.getByRole('img', { name: /Bag receipt QR for DLN-2026-79FFFC75/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Print bag label' })).toBeVisible();

    const drawn = vi.mocked(QRCode.toCanvas).mock.calls[0][1] as string;
    expect(decodeReceiptQr(drawn)).toMatchObject({
      ref: 'DLN-2026-79FFFC75',
      name: 'Lakshmi Devi',
      bags: 4,
      kg: 11,
      lane: 'premises',
    });
  });

  it('labels the handoff as Centre for drop-off receipts', () => {
    render(
      <ReceiptCard
        receipt={{
          ref: 'DLN-2026-81AAAB12',
          name: 'Ravi Kumar',
          bags: 2,
          kg: 5,
          at: '2026-09-09T11:00:00+05:30',
          via: 'Jayanagar Centre',
          lane: 'dropoff',
        }}
      />,
    );

    expect(screen.getByText('Centre')).toBeVisible();
    expect(screen.getByText('Jayanagar Centre')).toBeVisible();
  });
});
