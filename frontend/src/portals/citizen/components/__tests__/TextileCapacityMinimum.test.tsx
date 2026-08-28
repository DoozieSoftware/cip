/* eslint-disable */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { TextileMinimumNotice } from '../TextileMinimumNotice';
import * as api from '../../api/textileZones';
import { request as clientRequest } from '../../../../shared/api/client';

vi.mock('../../../../shared/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../../../shared/api/client')>(
    '../../../../shared/api/client',
  );
  return {
    ...actual,
    request: vi.fn(),
    upload: vi.fn(),
  };
});

describe('TextileCapacityMinimum integration', () => {
  it('requestCapacityException sends Idempotency-Key and reason', async () => {
    const mockRequest = vi.mocked(clientRequest);
    mockRequest.mockResolvedValue({
      id: 'exc-1',
      status: 'pending',
      reason: 'test reason longer than ten',
      reason_code: 'below_minimum',
    } as unknown as ReturnType<typeof clientRequest>);

    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
      Object.defineProperty(crypto, 'randomUUID', {
        value: vi.fn(() => 'uuid-1'),
        writable: true,
        configurable: true,
      });
    }

    const input = {
      collectionId: 'col-123',
      reason: 'Urgently need this below minimum request approved',
      reason_code: 'below_minimum',
    };
    const result = await api.requestCapacityException(input);

    expect(result.id).toBe('exc-1');
    expect(mockRequest).toHaveBeenCalledWith(
      '/citizen/textile-collections/col-123/capacity-exception',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ reason: input.reason, reason_code: 'below_minimum' }),
        headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
      }),
    );
  });

  it('requestCapacityException uses provided idempotency_key when supplied', async () => {
    const mockRequest = vi.mocked(clientRequest);
    mockRequest.mockResolvedValue({
      id: 'exc-2',
      status: 'pending',
      reason: 'reason text here',
      reason_code: null,
    } as never);
    await api.requestCapacityException({
      collectionId: 'col-999',
      reason: 'Reason with at least ten',
      idempotency_key: 'custom-key-123',
    });
    expect(mockRequest).toHaveBeenCalledWith(
      '/citizen/textile-collections/col-999/capacity-exception',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': 'custom-key-123' }),
        body: expect.objectContaining({ idempotency_key: 'custom-key-123' }),
      }),
    );
  });

  it('requestCapacityException falls back to random idempotency when crypto is unavailable', async () => {
    const mockRequest = vi.mocked(clientRequest);
    mockRequest.mockResolvedValue({
      id: 'exc-3',
      status: 'pending',
      reason: 'another reason longer',
      reason_code: null,
    } as never);
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    await api.requestCapacityException({
      collectionId: 'col-321',
      reason: 'Reason fallback test 123',
    });
    expect(mockRequest).toHaveBeenCalledWith(
      '/citizen/textile-collections/col-321/capacity-exception',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': expect.stringMatching(/^textile-/) }),
      }),
    );
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true,
    });
  });
});

describe('TextileMinimumNotice — citizen journey (TextileCapacityMinimum.test)', () => {
  function qcWrapper({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }

  it('shows loading, then minimum, then CTA when below after load', async () => {
    const minimum = {
      service_zone_id: 'z1',
      min_bags: 5,
      min_weight_kg: null,
      guidance_text: 'Keep dry',
    };
    const { rerender } = render(
      <TextileMinimumNotice
        minimum={null}
        isLoading
        estimatedBags={2}
        onRequestException={vi.fn()}
      />,
      { wrapper: qcWrapper },
    );
    expect(screen.getByText(/Loading this partner/)).toBeInTheDocument();

    rerender(
      <TextileMinimumNotice minimum={minimum} estimatedBags={2} onRequestException={vi.fn()} />,
    );
    expect(screen.getByText(/5 bags/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request exception/i })).toBeInTheDocument();
  });

  it('does not show CTA after rerender when estimate now meets minimum', () => {
    const minimum = {
      service_zone_id: 'z1',
      min_bags: 3,
      min_weight_kg: null,
      guidance_text: null,
    };
    const { rerender } = render(
      <TextileMinimumNotice minimum={minimum} estimatedBags={1} onRequestException={vi.fn()} />,
      { wrapper: qcWrapper },
    );
    expect(screen.getByRole('button', { name: /Request exception/i })).toBeInTheDocument();
    rerender(
      <TextileMinimumNotice minimum={minimum} estimatedBags={5} onRequestException={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /Request exception/i })).not.toBeInTheDocument();
  });

  it('shows error then after retry shows minimum', async () => {
    const minimum = {
      service_zone_id: 'z1',
      min_bags: 2,
      min_weight_kg: null,
      guidance_text: null,
    };
    const onRetry = vi.fn();
    const { rerender } = render(<TextileMinimumNotice isError minimum={null} onRetry={onRetry} />, {
      wrapper: qcWrapper,
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(onRetry).toHaveBeenCalled();
    rerender(<TextileMinimumNotice minimum={minimum} estimatedBags={2} />);
    expect(screen.getByText(/2 bags/)).toBeInTheDocument();
  });

  it('empty state is calm and mentions review', () => {
    render(
      <TextileMinimumNotice
        minimum={{
          service_zone_id: 'z1',
          min_bags: null,
          min_weight_kg: null,
          guidance_text: null,
        }}
      />,
      { wrapper: qcWrapper },
    );
    expect(screen.getByText(/has not configured a minimum/)).toBeInTheDocument();
    expect(screen.getByText(/reviewed before it is scheduled/)).toBeInTheDocument();
  });
});
