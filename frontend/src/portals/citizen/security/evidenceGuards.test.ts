import { describe, it, expect } from 'vitest';
import { stripExif, evidencePreviewHandlers } from './evidenceGuards';

describe('evidencePreviewHandlers', () => {
  it('returns handlers that prevent default on context menu and drag', () => {
    const handlers = evidencePreviewHandlers();
    expect(handlers.draggable).toBe(false);

    let ctxCalls = 0;
    let dragCalls = 0;
    const ctxEvent = { preventDefault: () => { ctxCalls += 1; } } as unknown as React.MouseEvent;
    const dragEvent = { preventDefault: () => { dragCalls += 1; } } as unknown as React.DragEvent;

    handlers.onContextMenu(ctxEvent);
    handlers.onDragStart(dragEvent);

    expect(ctxCalls).toBe(1);
    expect(dragCalls).toBe(1);
  });

  it('returns stable handler identities across calls', () => {
    const a = evidencePreviewHandlers();
    const b = evidencePreviewHandlers();
    expect(a.onContextMenu).not.toBe(b.onContextMenu);
    expect(a.onDragStart).not.toBe(b.onDragStart);
    expect(a.draggable).toBe(b.draggable);
  });
});

/**
 * Build a minimal but valid JPEG (SOI + APP1/Exif + TIFF)
 * whose TIFF byte order is either "MM" (big-endian) or
 * "II" (little-endian).
 *
 * Layout (offsets relative to the TIFF header start):
 *  - 0: byte order ("MM"/"II")            (2 bytes)
 *  - 2: 0x002A magic                        (2 bytes)
 *  - 4: offset to IFD0 (8)                  (4 bytes)
 *  - 8: IFD0 (3 entries + next-IFD=0)
 *       * Make (0x010F)        inline "ABCD"
 *       * Orientation (0x0112) inline 6  (NOT stripped)
 *       * GPSInfo pointer (0x8825) -> 50
 *  - 50: GPS IFD (2 entries + next-IFD=0)
 *       * GPSLatitude (0x0002)  inline 0x11223344
 *       * GPSLongitude (0x0004) inline 0x55667788
 */
function makeJpeg(byteOrder: 'MM' | 'II'): Uint8Array {
  const little = byteOrder === 'II';
  const tiffLen = 80;
  const total = 2 + 2 + 2 + 6 + tiffLen; // SOI, marker, length, "Exif\0\0", tiff
  const buf = new ArrayBuffer(total);
  const bytes = new Uint8Array(buf);
  const dv = new DataView(buf);

  bytes[0] = 0xff; bytes[1] = 0xd8; // SOI
  bytes[2] = 0xff; bytes[3] = 0xe1; // APP1
  dv.setUint16(4, 2 + 6 + tiffLen, false); // segment length (big-endian)
  const exif = 6;
  bytes[exif] = 0x45; bytes[exif + 1] = 0x78; bytes[exif + 2] = 0x69;
  bytes[exif + 3] = 0x66; bytes[exif + 4] = 0x00; bytes[exif + 5] = 0x00;

  const ts = exif + 6; // tiffStart
  bytes[ts] = little ? 0x49 : 0x4d;
  bytes[ts + 1] = little ? 0x49 : 0x4d;
  dv.setUint16(ts + 2, 0x002a, little);
  dv.setUint32(ts + 4, 8, little);

  const u16 = (o: number, v: number) => dv.setUint16(ts + o, v, little);
  const u32 = (o: number, v: number) => dv.setUint32(ts + o, v, little);

  // IFD0
  u16(8, 3);
  u16(10, 0x010f); u16(12, 2); u32(14, 4); u32(18, 0x41424344); // Make
  u16(22, 0x0112); u16(24, 3); u32(26, 1); u16(30, 6);          // Orientation (not stripped)
  u16(34, 0x8825); u16(36, 4); u32(38, 1); u32(42, 50);         // GPS info pointer -> 50
  u32(46, 0); // next IFD

  // GPS IFD @ 50
  u16(50, 2);
  u16(52, 0x0002); u16(54, 4); u32(56, 1); u32(60, 0x11223344); // GPSLatitude
  u16(64, 0x0004); u16(66, 4); u32(68, 1); u32(72, 0x55667788); // GPSLongitude
  u32(76, 0); // next IFD

  return bytes;
}

function allZero(bytes: Uint8Array, from: number, to: number): boolean {
  for (let k = from; k < to; k++) if (bytes[k] !== 0) return false;
  return true;
}

describe('stripExif', () => {
  it('strips GPS + Make but preserves Orientation (MM / big-endian)', () => {
    const bytes = makeJpeg('MM');
    const out = new Uint8Array(stripExif(bytes.buffer as ArrayBuffer));

    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8); // SOI intact

    expect(allZero(out, 72, 76)).toBe(true);  // GPSLatitude value
    expect(allZero(out, 84, 88)).toBe(true);  // GPSLongitude value
    expect(allZero(out, 30, 34)).toBe(true);  // Make value

    expect(allZero(out, 42, 46)).toBe(false); // Orientation NOT stripped
    expect(allZero(out, 54, 58)).toBe(false); // GPS pointer NOT stripped
  });

  it('strips GPS + Make but preserves Orientation (II / little-endian)', () => {
    const bytes = makeJpeg('II');
    const out = new Uint8Array(stripExif(bytes.buffer as ArrayBuffer));

    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);

    expect(allZero(out, 72, 76)).toBe(true);  // GPSLatitude value
    expect(allZero(out, 84, 88)).toBe(true);  // GPSLongitude value
    expect(allZero(out, 30, 34)).toBe(true);  // Make value

    expect(allZero(out, 42, 46)).toBe(false); // Orientation NOT stripped
    expect(allZero(out, 54, 58)).toBe(false); // GPS pointer NOT stripped
  });

  it('returns a non-JPEG buffer unchanged', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x01, 0x02]);
    const before = png.slice();
    const out = new Uint8Array(stripExif(png.buffer));
    expect(Array.from(out)).toEqual(Array.from(before));
  });
});
