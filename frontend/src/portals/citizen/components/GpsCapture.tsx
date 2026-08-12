import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type JSX,
} from 'react';
import { cx } from '../../../shared/ui/cx';
import { mockGpsLikely, type MockGpsResult } from '../security/mockGps';
import { useMessages } from '../messages';

export interface CapturedLocation {
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  captured_at: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  gps_provider?: string;
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
    const { t } = useMessages();
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
          setError(t('gps.coarseFix', { accuracy: Math.round(pos.coords.accuracy) }));
        } else {
          setError(null);
        }
        const captured: CapturedLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
          captured_at: pos.timestamp,
          altitude: pos.coords.altitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          // The browser API does not expose the underlying chipset/provider;
          // record the capture mechanism so server-side provenance is explicit.
          gps_provider: 'browser_geolocation',
          mock_heuristic: mock,
        };
        onCapture(captured);
        return captured;
      },
      [maxAccuracyM, onCapture, t],
    );

    const requestLocation = useCallback(async (): Promise<CapturedLocation | null> => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        setPermissionDenied(false);
        setError(t('gps.notSupported'));
        return null;
      }
      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        setPermissionDenied(false);
        setError(t('gps.httpsRequired'));
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
              setError(t('gps.blocked'));
            } else if (err.code === 3) {
              setError(t('gps.timeout'));
            } else {
              setError(t('gps.unavailable'));
            }
            setBusy(false);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
        );
      });
    }, [handlePosition, t]);

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
            ⌖ {busy ? t('gps.locating') : t('gps.useMyLocation')}
          </button>
          {lastResult && lastResult.accuracy_m !== null ? (
            <span className="text-xs text-slate-600">
              {t('gps.lastFix', { accuracy: Math.round(lastResult.accuracy_m) })}
            </span>
          ) : null}
          {watch ? (
            <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs text-sky-800">
              {t('gps.watching')}
            </span>
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
                <p className="font-semibold">{t('gps.howToEnable')}</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs leading-5">
                  <li>{t('gps.howToStep1')}</li>
                  <li>{t('gps.howToStep2', { hostname: siteHostname })}</li>
                  <li>{t('gps.howToStep3')}</li>
                </ol>
                <button
                  type="button"
                  onClick={() => void requestLocation()}
                  disabled={busy}
                  className="mt-3 inline-flex min-h-11 items-center rounded-md border border-rose-300 bg-white px-3.5 py-2 text-sm font-semibold text-rose-800 shadow-sm hover:bg-rose-100 disabled:opacity-60"
                >
                  {busy ? t('gps.locating') : t('gps.tryAgain')}
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
            {t('gps.suspicious', { reasons: lastResult.reasons.join('; ') })}
          </p>
        ) : null}
      </div>
    );
  },
);
