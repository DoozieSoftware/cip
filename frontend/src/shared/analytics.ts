/**
 * Privacy-safe product telemetry. Events contain only coarse workflow
 * signals; never pass report text, coordinates, account ids, or device ids.
 * Analytics is best-effort and must never delay a citizen action.
 */
export type ProductEventCode =
  | 'report_start_clicked'
  | 'report_step_viewed'
  | 'report_completed'
  | 'report_queued_offline'
  | 'gps_error'
  | 'media_upload_failed'
  | 'notification_delivery_failed'
  | 'report_reopened'
  | 'accessibility_preference_changed'
  | 'performance_metric';

const API_BASE = (import.meta.env['VITE_API_BASE'] as string | undefined) ?? '/api/v1';

export function canUseAnalyticsBeacon(url: string, pageOrigin = window.location.origin): boolean {
  return new URL(url, pageOrigin).origin === pageOrigin;
}

export function trackProductEvent(
  eventCode: ProductEventCode,
  properties: Record<string, string> = {},
): void {
  const payload = JSON.stringify({ event_code: eventCode, properties });
  const url = `${API_BASE}/public/analytics/events`;

  try {
    // sendBeacon includes credentials for cross-origin requests. Production
    // serves the SPA and API on different origins, so that mode conflicts with
    // the API's credential-free public CORS policy. Keep beacon for same-origin
    // development only and use an explicitly credential-free fetch otherwise.
    if (canUseAnalyticsBeacon(url) && typeof navigator.sendBeacon === 'function') {
      const accepted = navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
      if (accepted) return;
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: payload,
      credentials: 'omit',
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Telemetry is deliberately non-blocking and unavailable in some webviews.
  }
}
