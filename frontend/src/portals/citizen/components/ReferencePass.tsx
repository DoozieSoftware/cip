import { useEffect, useRef, useState, type JSX } from 'react';
import { IconCopy, IconDownload } from '@tabler/icons-react';
import QRCode from 'qrcode';

export function ReferencePass({ reference }: { reference: string }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, reference, { width: 140, margin: 1 });
  }, [reference]);

  function copy(): void {
    void navigator.clipboard.writeText(reference).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function save(): void {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reference}.png`;
    a.click();
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5">
      <h2 className="text-sm font-medium">Your drop-off pass</h2>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Show this at the counter</p>
      <p className="mt-3 font-mono text-2xl font-semibold tracking-widest">{reference}</p>
      <div className="mt-3 flex justify-center">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`QR code for reference ${reference}`}
          className="rounded border border-black/10"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 px-4 text-sm font-medium"
        >
          <IconCopy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={save}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 px-4 text-sm font-medium"
        >
          <IconDownload className="h-4 w-4" /> Save as image
        </button>
      </div>
    </div>
  );
}
