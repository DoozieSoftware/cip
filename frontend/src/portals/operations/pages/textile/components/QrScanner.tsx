import { useEffect, useRef, useState, type JSX } from 'react';
import { IconCamera, IconX } from '@tabler/icons-react';

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

function getDetector(): BarcodeDetectorLike | null {
  const ctor = (
    window as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
    }
  ).BarcodeDetector;
  if (typeof ctor !== 'function') return null;
  try {
    return new ctor({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

/**
 * Bag QR scanner: live camera decode via the native BarcodeDetector where
 * available, otherwise a paste/type fallback. Reports the raw scanned text
 * upward — decoding stays in receiptQr.ts so both paths share validation.
 */
export function QrScanner({
  onScan,
  cameraLabel = 'Scan with camera',
  pasteLabel = 'Paste a receipt code',
  pastePlaceholder = 'Paste the scanned code',
  actionLabel = 'Verify',
  showPaste = true,
}: {
  onScan: (raw: string) => void;
  cameraLabel?: string;
  pasteLabel?: string;
  pastePlaceholder?: string;
  actionLabel?: string;
  showPaste?: boolean;
}): JSX.Element {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorSupported = typeof window !== 'undefined' && getDetector() !== null;

  useEffect(() => {
    if (!cameraOpen) return;
    let raf = 0;
    let stopped = false;
    const detector = getDetector();

    async function start(): Promise<void> {
      if (!detector || !videoRef.current) {
        setCameraError('Camera scanning is not available in this browser.');
        setCameraOpen(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const tick = async (): Promise<void> => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const first = codes[0]?.rawValue;
            if (first) {
              onScan(first);
              setCameraOpen(false);
              return;
            }
          } catch {
            // Transient frame failure — keep scanning.
          }
          raf = requestAnimationFrame(() => void tick());
        };
        void tick();
      } catch {
        if (!stopped) {
          setCameraError('Camera permission is blocked — paste the code instead.');
          setCameraOpen(false);
        }
      }
    }

    void start();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]);

  return (
    <div className="space-y-2">
      {detectorSupported ? (
        <button
          type="button"
          onClick={() => {
            setCameraError(null);
            setCameraOpen(true);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-4 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
        >
          <IconCamera className="h-4 w-4" aria-hidden="true" />
          {cameraLabel}
        </button>
      ) : showPaste ? (
        <p className="text-[11px] text-[var(--color-text-secondary)]">
          Camera scanning is not available in this browser — paste the code.
        </p>
      ) : null}
      {cameraError ? (
        <p role="status" className="text-[11px] text-[var(--color-text-secondary)]">
          {cameraError}
        </p>
      ) : null}
      {cameraOpen ? (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-black">
          <video ref={videoRef} muted playsInline className="h-56 w-full object-cover" />
          <button
            type="button"
            onClick={() => setCameraOpen(false)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 bg-black px-4 py-2 text-xs font-medium text-white"
          >
            <IconX className="h-3.5 w-3.5" aria-hidden="true" />
            Stop camera
          </button>
        </div>
      ) : null}
      {showPaste ? (
        <label className="block text-xs font-medium text-[var(--color-ink)]">
          {pasteLabel}
          <span className="mt-1 flex gap-2">
            <input
              type="text"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder={pastePlaceholder}
              aria-label={pasteLabel}
              className="block min-h-11 w-full min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
            />
            <button
              type="button"
              disabled={manual.trim() === ''}
              onClick={() => {
                onScan(manual);
                setManual('');
              }}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-[var(--color-ink)] px-4 text-xs font-semibold text-white hover:bg-black disabled:opacity-40"
            >
              {actionLabel}
            </button>
          </span>
        </label>
      ) : null}
    </div>
  );
}
