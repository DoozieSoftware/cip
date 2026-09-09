import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { encodeReceiptQr } from '../../operations/pages/textile/components/receiptQr';
import TextileReceiptVerifyPage from './TextileReceiptVerifyPage';

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('TextileReceiptVerifyPage', () => {
  it('shows bag details from a phone-scanned receipt URL', () => {
    const url = encodeReceiptQr(
      {
        ref: 'DLN-QR-DROPOFF-01',
        name: 'QR Test Citizen',
        bags: 2,
        kg: 5,
        at: '2026-09-09T18:51:00+05:30',
        via: 'Dr. Linen Jayanagar collection point',
        lane: 'dropoff',
      },
      window.location.origin,
    );
    window.history.replaceState(null, '', url);

    render(<TextileReceiptVerifyPage />);

    expect(screen.getByRole('heading', { name: 'DLN-QR-DROPOFF-01' })).toBeVisible();
    expect(screen.getByText('QR Test Citizen')).toBeVisible();
    expect(screen.getByText('2 bags · 5 kg')).toBeVisible();
    expect(screen.getByText('Dr. Linen Jayanagar collection point')).toBeVisible();
  });

  it('shows a useful error when the URL has no receipt payload', () => {
    window.history.replaceState(null, '', '/public/textile-receipt');

    render(<TextileReceiptVerifyPage />);

    expect(screen.getByRole('heading', { name: 'Unreadable bag label' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(/not a bag receipt QR/);
  });
});
