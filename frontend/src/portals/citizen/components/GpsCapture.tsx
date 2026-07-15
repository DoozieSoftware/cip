import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type JSX,
} from 'react';
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
 *  - Captures every fix and surfaces its reverse-geocoded place
 *    name. When accuracy is worse than `maxAccuracyM` (default
 *    100 m) the reporter sees a warning but the fix is still
 *    captured, so the place name displays and the report can be
 *    submitted; the server decides what to do with a coarse fix.
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
  autoRequest?: boolean;
}

export interface GpsCaptureHandle {
  requestLocation: () => Promise<CapturedLocation | null>;
}

export const GpsCapture = forwardRef<GpsCaptureHandle, GpsCaptureProps>(
  function GpsCapture(props, ref): JSX.Element {
    const { onCapture, maxAccuracyM = 100, className, watch = false, autoRequest = false } = props;
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const historyRef = useRef<Array<{ altitude: number | null }>>([]);
    const [lastResult, setLastResult] = useState<MockGpsResult | null>(null);
    const siteHostname =
      typeof window !== 'undefined' && window.location.hostname
        ? window.location.hostname
        : 'this site';

    const handlePosition = useCallback(
      (pos: GeolocationPosition): CapturedLocation | null => {
        const hist = [...historyRef.current, { altitude: pos.coords.altitude }].slice(-5);
        historyRef.current = hist;
        const mock = mockGpsLikely(pos, hist.slice(0, -1));
        setLastResult(mock);
        const coarse = pos.coords.accuracy > maxAccuracyM;
        if (coarse) {
          setError(
            `GPS accuracy is ±${Math.round(pos.coords.accuracy)} m — try moving to an open area for a sharper fix. The reported place is still used.`,
          );
        } else {
          setError(null);
        }
        const captured: CapturedLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
          captured_at: pos.timestamp,
          mock_heuristic: mock,
        };
        onCapture(captured);
        return captured;
      },
      [maxAccuracyM, onCapture],
    );

    const requestLocation = useCallback(async (): Promise<CapturedLocation | null> => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        setPermissionDenied(false);
        setError('Geolocation not supported in this browser.');
        return null;
      }
      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        setPermissionDenied(false);
        setError('Location permission requires HTTPS or localhost.');
        return null;
      }

      setPermissionDenied(false);
      setBusy(true);
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const captured = handlePosition(pos);
            setBusy(false);
            resolve(captured);
          },
          (err) => {
            if (err.code === 1) {
              setPermissionDenied(true);
              setError(
                'Location access is blocked. Enable it in your phone and browser settings, then try again.',
              );
            } else if (err.code === 3) {
              setError('Location lookup timed out. Move to an open area and try again.');
            } else {
              setError(
                'Your location is unavailable. Check that Location Services are on, then try again.',
              );
            }
            setBusy(false);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
        );
      });
    }, [handlePosition]);

    useImperativeHandle(ref, () => ({ requestLocation }), [requestLocation]);

    useEffect(() => {
      if (autoRequest) void requestLocation();
    }, [autoRequest, requestLocation]);

    return (
      <div className={cx('space-y-2', className)}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void requestLocation()}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:bg-blue-300"
          >
            ⌖ {busy ? 'Locating…' : 'Use my location'}
          </button>
          {lastResult && lastResult.accuracy_m !== null ? (
            <span className="text-xs text-slate-600">
              last fix ±{Math.round(lastResult.accuracy_m)} m
            </span>
          ) : null}
          {watch ? (
            <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs text-sky-800">watching</span>
          ) : null}
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-rose-300 bg-rose-50 px-3 py-3 text-sm text-rose-900"
          >
            <p className="font-medium">{error}</p>
            {permissionDenied ? (
              <div className="mt-3 border-t border-rose-200 pt-3">
                <p className="font-semibold">How to enable location</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs leading-5">
                  <li>Open your phone Settings and allow Location for this browser.</li>
                  <li>In the browser site settings, allow Location for {siteHostname}.</li>
                  <li>Return here and tap Try again.</li>
                </ol>
                <button
                  type="button"
                  onClick={() => void requestLocation()}
                  disabled={busy}
                  className="mt-3 inline-flex min-h-11 items-center rounded-md border border-rose-300 bg-white px-3.5 py-2 text-sm font-semibold text-rose-800 shadow-sm hover:bg-rose-100 disabled:opacity-60"
                >
                  {busy ? 'Locating…' : 'Try again'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {lastResult?.likely ? (
          <p
            role="alert"
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
          >
            This location looks suspicious ({lastResult.reasons.join('; ')}). The platform may
            reject it.
          </p>
        ) : null}
      </div>
    );
  },
);
