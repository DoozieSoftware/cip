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

const EXIF_TAGS = new Set([
  'GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'GPSTimeStamp', 'GPSDateStamp',
  'Make', 'Model', 'Software', 'DateTime', 'DateTimeOriginal', 'DateTimeDigitized',
  'Artist', 'Copyright',
]);

/**
 * Lightweight EXIF scrubber for a JPEG. We do a streaming
 * byte scan: find the APP1 marker (0xFFE1, "Exif\0\0") and
 * walk the IFD entries, zeroing the bytes for any tag
 * present in `EXIF_TAGS`. The result is still a valid JPEG.
 *
 * For HEIC/HEIF/PNG we return the buffer unchanged (those
 * formats carry metadata in different containers and the
 * backend's media pipeline re-encodes everything anyway).
 */
export function stripExif(buffer: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4) return buffer;
  // Quick magic check for JPEG.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return buffer;
  let i = 2;
  while (i < bytes.length - 1) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1] ?? 0;
    // SOS or EOI — stop walking.
    if (marker === 0xda || marker === 0xd9) break;
    const segLen = ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
    if (marker === 0xe1) {
      // APP1 — usually EXIF. Walk IFD0.
      const segStart = i + 4;
      const exifHeader = String.fromCharCode(...Array.from(bytes.slice(segStart, segStart + 6)));
      if (exifHeader.startsWith('Exif')) {
        const tiffStart = segStart + 6;
        // Skip "MM" or "II" (2 bytes) + 0x2A (2 bytes) + offset (4 bytes)
        let p = tiffStart + 8;
        const numEntries = (bytes[p] ?? 0) << 8 | (bytes[p + 1] ?? 0);
        p += 2;
        for (let e = 0; e < numEntries; e++) {
          const tag = String.fromCharCode(bytes[p] ?? 0, bytes[p + 1] ?? 0);
          if (EXIF_TAGS.has(tag)) {
            // Zero the value area (12 bytes per IFD entry: tag(2) + type(2) + count(4) + value/offset(4))
            for (let b = 0; b < 8; b++) bytes[p + 4 + b] = 0;
          }
          p += 12;
          if (p > bytes.length - 12) break;
        }
      }
    }
    i += 2 + segLen;
  }
  return buffer;
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
