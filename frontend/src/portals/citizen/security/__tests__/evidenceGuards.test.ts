import { describe, it, expect } from 'vitest';
import {
  blockFileInputs,
  evidencePreviewHandlers,
  guardVideoDuration,
  stripExif,
} from '../evidenceGuards';

describe('evidenceGuards (T-M13-019 / T-M13-027)', () => {
  it('blockFileInputs forces image accept and rear-camera capture', () => {
    const p = blockFileInputs();
    expect(p.accept).toBe('image/*');
    expect(p.capture).toBe('environment');
  });

  it('evidencePreviewHandlers returns non-draggable + preventDefault handlers', () => {
    const p = evidencePreviewHandlers();
    expect(p.draggable).toBe(false);
    const drag = { preventDefault: () => undefined } as unknown as React.DragEvent;
    const ctx = { preventDefault: () => undefined } as unknown as React.MouseEvent;
    p.onDragStart(drag);
    p.onContextMenu(ctx);
  });

  it('guardVideoDuration accepts a duration inside the window', () => {
    const r = guardVideoDuration(4_200, 3_000, 5_000);
    expect(r.ok).toBe(true);
  });

  it('guardVideoDuration rejects a too-short clip', () => {
    const r = guardVideoDuration(1_500, 3_000, 5_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('too_short');
  });

  it('guardVideoDuration rejects a too-long clip', () => {
    const r = guardVideoDuration(6_500, 3_000, 5_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('too_long');
  });

  it('guardVideoDuration handles NaN / negative inputs safely', () => {
    expect(guardVideoDuration(Number.NaN).ok).toBe(false);
    expect(guardVideoDuration(-10).ok).toBe(false);
  });

  it('stripExif is a no-op for non-JPEG buffers', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
    expect(stripExif(png)).toBe(png);
  });
});
