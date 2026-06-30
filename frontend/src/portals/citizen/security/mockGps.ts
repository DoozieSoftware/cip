/**
 * T-M13-018 — Mock-GPS detection (best effort).
 *
 * Per `docs/11` §12 the platform rejects reports whose
 * location appears to come from a mock-GPS app. Browser
 * APIs do not give us a reliable "is this spoofed"
 * signal, so this is a heuristic stack. It must
 * never false-positive normal usage.
 */

export interface MockGpsResult {
  likely: boolean;
  score: number;
  reasons: string[];
  accuracy_m: number | null;
  age_ms: number | null;
}

export interface SampleInput {
  accuracy: number | null;
  timestamp: number;
  altitude: number | null;
  // Firefox exposes `coords.mock`; allow it as a hint.
  mock?: boolean | null;
}

type AnyPosition = GeolocationPosition | SampleInput;

function pickAccuracy(p: AnyPosition): number | null {
  if ('coords' in p) return (p as GeolocationPosition).coords.accuracy;
  return (p as SampleInput).accuracy;
}
function pickAltitude(p: AnyPosition): number | null {
  if ('coords' in p) return (p as GeolocationPosition).coords.altitude;
  return (p as SampleInput).altitude;
}
function pickTimestamp(p: AnyPosition): number {
  if ('coords' in p) return (p as GeolocationPosition).timestamp;
  return (p as SampleInput).timestamp;
}
function pickMock(p: AnyPosition): boolean | null | undefined {
  if ('coords' in p) {
    const c = (p as GeolocationPosition).coords as { mock?: boolean | null };
    return c.mock;
  }
  return (p as SampleInput).mock;
}

export function mockGpsLikely(
  position: AnyPosition,
  history: Array<{ altitude: number | null }> = [],
): MockGpsResult {
  const accuracy = pickAccuracy(position);
  const timestamp = pickTimestamp(position);
  const altitude = pickAltitude(position);
  const reasons: string[] = [];
  let score = 0;

  // Mock-flag explicit hint (Firefox).
  const mockFlag = pickMock(position);
  if (mockFlag === true) {
    return {
      likely: true,
      score: 1,
      reasons: ['browser flagged the position as mock'],
      accuracy_m: accuracy,
      age_ms: Date.now() - timestamp,
    };
  }

  // Implausibly high accuracy.
  if (accuracy !== null && accuracy >= 0 && accuracy < 5) {
    score += 0.4;
    reasons.push(`accuracy too high (${accuracy.toFixed(0)} m)`);
  }

  // Stale cached fix (older than 30s is suspicious when the
  // user just tapped the button).
  const age_ms = Date.now() - timestamp;
  if (age_ms > 30_000) {
    score += 0.2;
    reasons.push(`fix is ${Math.round(age_ms / 1000)}s old`);
  }

  // Implausibly perfect altitude repeated across samples.
  if (history.length >= 2 && altitude !== null) {
    const sameAlt = history.every((h) => h.altitude !== null && Math.abs((h.altitude ?? 0) - altitude) < 0.5);
    if (sameAlt) {
      score += 0.3;
      reasons.push('altitude is implausibly constant across samples');
    }
  }

  return {
    likely: score >= 0.5,
    score: Math.min(1, score),
    reasons,
    accuracy_m: accuracy,
    age_ms,
  };
}
