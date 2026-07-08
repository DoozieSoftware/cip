import { useEffect, useRef, useState, type JSX } from 'react';
import { cx } from '../../moderator/design/cx';
import { guardVideoDuration, scrubFile } from "../security/evidenceGuards";

/**
 * T-M13-008 / T-M13-019 — Camera capture component.
 *
 * Rules:
  *  - Live capture only (MediaDevices.getUserMedia); no file
 *    picker. The DOM has no <input type="file">.
 *  - Video capture is camera-only. Audio is intentionally disabled so
 *    the browser does not block recording when microphone permission is
 *    denied; civic evidence does not require voice/audio.
 *  - Per `docs/06` §12, videos are clamped to 3..5 s.
 *  - Photos are produced as JPEG with EXIF scrubbed
 *    (see `evidenceGuards.scrubFile`).
 *  - Right-click + drag are blocked on previews
 *    (`evidencePreviewHandlers`).
 */

export type CameraError =
  | { kind: 'permission_denied'; message: string }
  | { kind: 'not_found'; message: string }
  | { kind: 'video_too_short'; message: string }
  | { kind: 'video_too_long'; message: string }
  | { kind: 'unknown'; message: string };

export interface CameraCaptureProps {
  mode: 'photo' | 'video';
  onCapture: (file: File) => void;
  onError?: (err: CameraError) => void;
  videoMinMs?: number;
  videoMaxMs?: number;
  className?: string;
}

const DEFAULT_VIDEO_MIN = 3_000;
const DEFAULT_VIDEO_MAX = 5_000;

const VIDEO_MIME_CANDIDATES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm'];

function pickVideoMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  const supported = VIDEO_MIME_CANDIDATES.find((m) => {
    try {
      return MediaRecorder.isTypeSupported(m);
    } catch {
      return false;
    }
  });
  return supported ?? 'video/webm';
}

export function CameraCapture(props: CameraCaptureProps): JSX.Element {
  const { mode, onCapture, onError, videoMinMs = DEFAULT_VIDEO_MIN, videoMaxMs = DEFAULT_VIDEO_MAX, className } = props;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);

  const [active, setActive] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);
  const stoppedAtRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      stopStream();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch { /* noop */ }
      }
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => {
      if (mode === 'video' && startedAtRef.current > 0) {
        setRecordingMs(Date.now() - startedAtRef.current);
      }
    }, 100);
    return () => window.clearInterval(t);
  }, [active, mode]);

  async function startCamera(): Promise<void> {
    setError(null);
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      const e: CameraError = {
        kind: 'permission_denied',
        message: 'Camera access requires HTTPS or localhost. Open the app with https:// and try again.',
      };
      setError(e);
      onError?.(e);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const e: CameraError = { kind: 'not_found', message: 'Camera not available in this browser.' };
      setError(e);
      onError?.(e);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (err) {
      const permissionBlocked = err instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(err.name);
      const e: CameraError = {
        kind: 'permission_denied',
        message: permissionBlocked
          ? 'Camera permission is blocked. Open browser site settings for this site, allow Camera, then tap Open camera again.'
          : err instanceof Error ? err.message : 'Camera access denied.',
      };
      setError(e);
      onError?.(e);
    }
  }

  function stopStream(): void {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    setActive(false);
  }

  async function takePhoto(): Promise<void> {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) return;
    const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
    const cleaned = await scrubFile(file);
    onCapture(cleaned);
    stopStream();
  }

   function startRecording(): void {
     if (!streamRef.current) return;
     if (typeof MediaRecorder === 'undefined') {
       const err: CameraError = {
         kind: 'not_found',
         message: 'Video recording is not supported by this browser. Try Chrome or Safari 17+ on HTTPS.',
       };
       setError(err);
       onError?.(err);
       return;
     }
     chunksRef.current = [];
     stoppedAtRef.current = 0;
     const mimeType = pickVideoMimeType();
     let rec: MediaRecorder;
     try {
       rec = new MediaRecorder(streamRef.current, { mimeType });
     } catch {
       // Some mobile browsers expose MediaRecorder but reject explicit
       // mime hints. Retry with browser defaults before failing.
       try {
         rec = new MediaRecorder(streamRef.current);
       } catch {
         const err: CameraError = {
           kind: 'not_found',
           message: 'Video recording is not supported by this browser. Try Chrome or Safari 17+ on HTTPS.',
         };
         setError(err);
         onError?.(err);
         return;
       }
     }
    rec.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    // Mark the real start the moment capture actually begins, not when
    // start() is *called* (MediaRecorder has a short warm-up delay).
    rec.onstart = () => {
      startedAtRef.current = Date.now();
    };
    rec.onstop = () => {
      // Measure to the instant stop() was clicked, not to onstop firing
      // (which happens after the blob is assembled/encoded). Otherwise
      // encoder overhead is counted as recording time and near-limit
      // clips get falsely rejected as too_long.
      const end = stoppedAtRef.current || Date.now();
      const duration = end - startedAtRef.current;
      const result = guardVideoDuration(duration, videoMinMs, videoMaxMs);
      if (!result.ok) {
        const err: CameraError = {
          kind: result.kind === 'too_short' ? 'video_too_short' : 'video_too_long',
          message: result.message,
        };
        setError(err);
        onError?.(err);
        stopStream();
        return;
      }
      const blobType = rec.mimeType || mimeType;
      const blob = new Blob(chunksRef.current, { type: blobType });
      const ext = blobType.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `video-${Date.now()}.${ext}`, { type: blobType });
      onCapture(file);
      stopStream();
    };
    recorderRef.current = rec;
    startedAtRef.current = Date.now();
    rec.start();
  }

  function stopRecording(): void {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      stoppedAtRef.current = Date.now();
      recorderRef.current.stop();
    }
  }

  return (
    <div className={cx('space-y-3', className)}>
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {!active ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
            <span aria-hidden className="text-4xl">◎</span>
            <p className="text-sm">Camera off</p>
          </div>
        ) : null}
        {active && mode === 'video' && recordingMs > 0 ? (
          <div
            aria-live="polite"
            className={cx(
              'absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white',
              recordingMs > videoMaxMs - 1000 ? 'text-rose-300' : 'text-blue-300',
            )}
          >
            ● {(recordingMs / 1000).toFixed(1)}s
          </div>
        ) : null}
      </div>

       {error ? (
         <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
           {error.message}
         </p>
       ) : mode === 'video' && !active ? (
         <p className="text-xs text-slate-500">
           Record a short clip between {videoMinMs / 1000} and {videoMaxMs / 1000} seconds.
         </p>
       ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {!active ? (
          <button
            type="button"
            onClick={() => void startCamera()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Open camera
          </button>
        ) : mode === 'photo' ? (
          <button
            type="button"
            onClick={() => void takePhoto()}
            className="rounded-full bg-white p-4 shadow ring-2 ring-blue-500 transition hover:bg-blue-50"
            aria-label="Take photo"
          >
            <span aria-hidden className="block h-12 w-12 rounded-full bg-blue-600" />
          </button>
        ) : recorderRef.current?.state === 'recording' ? (
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
          >
            Stop recording
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
          >
            Start recording
          </button>
        )}
      </div>

    </div>
  );
}
