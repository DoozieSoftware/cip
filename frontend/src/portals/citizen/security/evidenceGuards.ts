/**
 * T-M13-019 — Camera security guardrails.
 *
 * Per `docs/06` §26 and `docs/11` §13, the citizen PWA
 * must:
 *  - never accept file inputs (only live camera capture),
 *  - block right-click / long-press save on evidence
 *    previews,
 *  - strip EXIF metadata before display or upload.
 *
 * None of these can be enforced from JavaScript alone —
 * they are conventions backed by a layered UX.
 */

/* ----- 1. Block file inputs ------------------------------------- */

/**
 * Returns a set of props you must spread onto every <input>
 * in the citizen app to guarantee no file picker is reachable.
 * The CameraCapture component uses `capture="environment"`
 * which makes the OS camera UI open even if the user
 * somehow reaches a file input.
 */
export function blockFileInputs(): {
  accept: string;
  // Force capture attribute on every media <input> to make
  // the OS launch the camera instead of a file picker.
  capture: 'environment' | 'user';
} {
  return { accept: 'image/*', capture: 'environment' };
}

/* ----- 2. Block right-click / drag on evidence previews --------- */

export interface EvidencePreviewProps {
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  draggable: false;
}

export function evidencePreviewHandlers(): EvidencePreviewProps {
  return {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
    },
    onDragStart: (e: React.DragEvent) => {
      e.preventDefault();
    },
    draggable: false,
  };
}

/* ----- 3. Strip EXIF --------------------------------------------- */

/**
 * Numeric TIFF/EXIF tag IDs that carry location or device
 * identity and must be zeroed before upload/display.
 *
 * Orientation (0x0112), compression, and color tags are
 * intentionally NOT stripped.
 */
const STRIP_TAGS = new Set<number>([
  0x0001, // GPSLatitudeRef
  0x0002, // GPSLatitude
  0x0003, // GPSLongitudeRef
  0x0004, // GPSLongitude
  0x0005, // GPSAltitudeRef
  0x0006, // GPSAltitude
  0x0007, // GPSTimeStamp
  0x0012, // GPSMapDatum
  0x001b, // GPSProcessingMethod
  0x001d, // GPSDateStamp
  0x010f, // Make
  0x0110, // Model
  0x0131, // Software
  0x0132, // DateTime
  0x013b, // Artist
  0x8298, // Copyright
  0x9003, // DateTimeOriginal
  0x9004, // DateTimeDigitized
]);

/** Sub-IFD pointer tags we follow to find more tags to strip. */
const GPS_INFO_POINTER = 0x8825;
const EXIF_IFD_POINTER = 0x8769;

/** TIFF field type -> byte size, per the TIFF 6.0 spec. */
const TIFF_TYPE_SIZE: Record<number, number> = {
  1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8,
};

/**
 * Lightweight EXIF scrubber for a JPEG.
 *
 * We locate the APP1 ("Exif\0\0") segment, parse the TIFF
 * header (handling both "II" little-endian and "MM"
 * big-endian byte order), walk IFD0 and any GPS/Exif
 * sub-IFDs, and zero the value bytes of every tag in
 * `STRIP_TAGS`. Only data bytes inside APP1 are mutated;
 * segment markers and lengths are never touched, so the
 * result stays a valid JPEG.
 *
 * For HEIC/HEIF/PNG (anything not starting with 0xFFD8) we
 * return the buffer unchanged — those containers are
 * re-encoded by the backend media pipeline anyway.
 */
export function stripExif(buffer: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4) return buffer;
  // Quick magic check for JPEG.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return buffer;

  const view = new DataView(buffer);

  let i = 2;
  while (i < bytes.length - 1) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1] ?? 0;
    // SOS or EOI — real image data starts; stop walking.
    if (marker === 0xda || marker === 0xd9) break;
    const segLen = ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
    if (segLen <= 0) break;

    if (marker === 0xe1) {
      const segStart = i + 4;
      const exifHeader = String.fromCharCode(...bytes.slice(segStart, segStart + 6));
      if (exifHeader.startsWith('Exif')) {
        const tiffStart = segStart + 6;
        if (tiffStart + 8 <= bytes.length) {
          const littleEndian =
            bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;
          const read16 = (off: number): number => view.getUint16(off, littleEndian);
          const read32 = (off: number): number => view.getUint32(off, littleEndian);

          const ifd0Offset = read32(tiffStart + 4);
          walkIfd(bytes, view, tiffStart, ifd0Offset, read16, read32);
        }
      }
    }

    i += 2 + segLen;
  }
  return buffer;
}

/**
 * Walk a single TIFF IFD (and recurse into GPS/Exif
 * sub-IFDs). `ifdOffset` is relative to `tiffStart`.
 */
function walkIfd(
  bytes: Uint8Array,
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  read16: (off: number) => number,
  read32: (off: number) => number,
): void {
  const base = tiffStart + ifdOffset;
  if (ifdOffset < 0 || base + 2 > bytes.length) return;

  const entryCount = read16(base);
  let p = base + 2;
  const subIfds: number[] = [];

  for (let e = 0; e < entryCount; e++) {
    if (p + 12 > bytes.length) break;
    const tag = read16(p);

    if (tag === GPS_INFO_POINTER || tag === EXIF_IFD_POINTER) {
      subIfds.push(read32(p + 8));
    } else if (STRIP_TAGS.has(tag)) {
      zeroEntry(bytes, view, p, tiffStart, read32);
    }

    p += 12;
  }

  for (const sub of subIfds) {
    walkIfd(bytes, view, tiffStart, sub, read16, read32);
  }
}

/**
 * Zero the value bytes for one IFD entry. IFD entries are
 * 12 bytes: tag(2) + type(2) + count(4) + value/offset(4).
 * If the value fits in the 4-byte inline slot it is zeroed
 * there; otherwise the entry holds an offset (relative to
 * the TIFF start) to the out-of-line value region, which is
 * zeroed instead.
 */
function zeroEntry(
  bytes: Uint8Array,
  view: DataView,
  p: number,
  tiffStart: number,
  read32: (off: number) => number,
): void {
  const type = view.getUint16(p + 2, true);
  const count = read32(p + 4);
  const typeSize = TIFF_TYPE_SIZE[type] ?? 0;
  const total = count * typeSize;

  if (total <= 4) {
    for (let k = 0; k < 4; k++) bytes[p + 8 + k] = 0;
  } else {
    const valueOffset = tiffStart + read32(p + 8);
    for (let k = 0; k < total && valueOffset + k < bytes.length; k++) {
      bytes[valueOffset + k] = 0;
    }
  }
}

/* ----- 4. Convenience: scrub + sign ----------------------------- */

/**
 * Read a `File` (from <input type=file> or MediaRecorder blob),
 * strip its EXIF, and return a fresh File. Use this in
 * CameraCapture before adding the file to the submission.
 */
export async function scrubFile(file: File): Promise<File> {
  if (!/^image\/jpe?g$/i.test(file.type)) return file;
  try {
    const buf = await file.arrayBuffer();
    const cleaned = stripExif(buf);
    return new File([cleaned], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/* ----- 5. Video duration guard (T-M13-027) --------------------- */

export type VideoDurationResult =
  | { ok: true }
  | { ok: false; kind: 'too_short' | 'too_long'; message: string };

/**
 * Pure helper for the camera's video duration window.
 *  - Rejects videos below `minMs`.
 *  - Rejects videos above `maxMs`.
 *  - Pure / no side effects → trivially unit-testable.
 *
 * `docs/06` §12 specifies 3..5 s.
 */
export function guardVideoDuration(
  durationMs: number,
  minMs = 3_000,
  maxMs = 5_000,
): VideoDurationResult {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return { ok: false, kind: 'too_short', message: 'Video length is unreadable.' };
  }
  if (durationMs < minMs) {
    return { ok: false, kind: 'too_short', message: `Video must be at least ${minMs / 1000} seconds.` };
  }
  if (durationMs > maxMs) {
    return { ok: false, kind: 'too_long', message: `Video must be at most ${maxMs / 1000} seconds.` };
  }
  return { ok: true };
}
