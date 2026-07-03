import { useEffect, useState, type JSX } from 'react';
import { cx } from '../../moderator/design/cx';
import { mockGpsLikely, type MockGpsResult } from '../security/mockGps';

export interface CapturedLocation {
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  captured_at: number;
  mock_heuristic: MockGpsResult;
}

/**
 * T-M13-009 / T-M13-018 — GPS capture component.
 *
 *  - Reads `navigator.geolocation` with high-accuracy mode.
 *  - Rejects fixes whose accuracy is above `maxAccuracyM`
 *    (default 50 m). The reporter can re-try.
 *  - Runs `mockGpsLikely` on every fix. If the heuristic
 *    score crosses the threshold the citizen sees a
 *    warning and the form surfaces a flag in the report
 *    metadata (the server decides what to do).
 */
export interface GpsCaptureProps {
  onCapture: (loc: CapturedLocation) => void;
  maxAccuracyM?: number;
  className?: string;
  watch?: boolean;
}

export function GpsCapture(props: GpsCaptureProps): JSX.Element {
  const { onCapture, maxAccuracyM = 100, className, watch = false } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ altitude: number | null }>>([]);
  const [lastResult, setLastResult] = useState<MockGpsResult | null>(null);

  useEffect(() => {
    detect();
  }, []);

  function handlePosition(pos: GeolocationPosition): void {
    const hist = [...history, { altitude: pos.coords.altitude }].slice(-5);
    setHistory(hist);
    const mock = mockGpsLikely(pos, hist.slice(0, -1));
    setLastResult(mock);
    if (pos.coords.accuracy > maxAccuracyM) {
      setError(`GPS accuracy is ±${Math.round(pos.coords.accuracy)} m — try moving to an open area.`);
      return;
    }
    setError(null);
    onCapture({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy_m: pos.coords.accuracy,
      captured_at: pos.timestamp,
      mock_heuristic: mock,
    });
  }

  function detect(): void {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported in this browser.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePosition(pos);
        setBusy(false);
      },
      (err) => {
        setError(err.message);
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }

  return (
    <div className={cx('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={detect}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:bg-emerald-300"
        >
          📍 {busy ? 'Locating…' : 'Use my location'}
        </button>
        {lastResult && lastResult.accuracy_m !== null ? (
          <span className="text-xs text-slate-600">last fix ±{Math.round(lastResult.accuracy_m)} m</span>
        ) : null}
        {watch ? (
          <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs text-sky-800">watching</span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      ) : null}

      {lastResult?.likely ? (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This location looks suspicious ({lastResult.reasons.join('; ')}). The platform may reject it.
        </p>
      ) : null}
    </div>
  );
}
