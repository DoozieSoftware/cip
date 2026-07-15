import type { AiResult, ReportStatusCode } from '../types';
import { Card, CardHeader, CardTitle, CardBody, Badge } from '../design';

function pct(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  return `${Math.round(n)}%`;
}

function scoreTone(n: number | null | undefined, threshold = 60) {
  if (n === null || n === undefined) return 'neutral' as const;
  if (n >= threshold + 20) return 'danger' as const;
  if (n >= threshold) return 'warning' as const;
  return 'success' as const;
}

export interface AiAnalysisPanelProps {
  ai: AiResult | null;
  statusCode?: ReportStatusCode;
  /** Citizen PWA's client-side mock-GPS heuristic (0..1). Triage signal only — never a reason to auto-reject. */
  mockGpsScore?: number | null;
}

function mockGpsPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${Math.round(n * 100)}%`;
}

export function AiAnalysisPanel({ ai, statusCode, mockGpsScore }: AiAnalysisPanelProps) {
  if (!ai) {
    const message =
      statusCode === 'ai_processing'
        ? 'AI analysis is still processing. This can take a few minutes while the vision provider warms up.'
        : 'No AI result is available for this report.';

    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Analysis</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-slate-500">{message}</p>
          {mockGpsScore !== null && mockGpsScore !== undefined && (
            <Stat
              label="Mock GPS score"
              value={mockGpsPct(mockGpsScore)}
              tone={scoreTone(mockGpsScore * 100)}
            />
          )}
        </CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Analysis</CardTitle>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>
            Provider: <code className="rounded bg-slate-100 px-1">{ai.provider_code}</code>
          </span>
          <span>Prompt v{ai.prompt_version}</span>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="AI confidence" value={pct(ai.confidence)} />
          <Stat label="Fraud risk" value={pct(ai.fraud_score)} tone={scoreTone(ai.fraud_score)} />
          <Stat
            label="Duplicate risk"
            value={pct(ai.duplicate_score)}
            tone={scoreTone(ai.duplicate_score)}
          />
          <Stat label="Image quality" value={pct(ai.quality_score)} />
          {mockGpsScore !== null && mockGpsScore !== undefined && (
            <Stat
              label="Mock GPS score"
              value={mockGpsPct(mockGpsScore)}
              tone={scoreTone(mockGpsScore * 100)}
            />
          )}
          {ai.consistency_score !== null && ai.consistency_score !== undefined && (
            <Stat
              label="Claim consistency"
              value={pct(ai.consistency_score)}
              tone={
                ai.consistency_score < 50
                  ? 'danger'
                  : ai.consistency_score < 80
                    ? 'warning'
                    : 'success'
              }
            />
          )}
        </div>

        {ai.claim_matches_evidence === false && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-red-700">
              Evidence does not match the claim
            </p>
            <p className="mt-1 text-sm text-red-800">
              {ai.mismatch_reason ||
                'The visual evidence does not support the submitted title or description.'}
            </p>
          </div>
        )}

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Recommendation
          </p>
          <p className="text-sm text-slate-800">
            Category: <strong>{ai.recommended_category?.name ?? '—'}</strong> · Department:{' '}
            <strong>{ai.recommended_department?.name ?? '—'}</strong>
          </p>
        </div>

        {ai.license_plate && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
              Detected License Plate (ANPR)
            </p>
            <div className="mt-1 flex items-center gap-3">
              <span className="font-mono text-2xl font-bold tracking-widest text-slate-900">
                {ai.license_plate}
              </span>
              {ai.plate_confidence !== null && ai.plate_confidence !== undefined && (
                <Badge tone={ai.plate_confidence >= 0.8 ? 'success' : 'warning'}>
                  {Math.round(ai.plate_confidence * 100)}% confidence
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-amber-700">
              Verify against the evidence photo before acting.
            </p>
          </div>
        )}

        {ai.labels.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Labels
            </p>
            <ul className="flex flex-wrap gap-2">
              {ai.labels.map((l) => (
                <li key={l.id}>
                  <Badge tone="info">
                    {l.name} · {l.confidence.toFixed(0)}%
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ai.notes && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Notes</p>
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{ai.notes}</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      {tone && tone !== 'neutral' && (
        <Badge tone={tone}>
          {tone === 'success' ? 'ok' : tone === 'warning' ? 'review' : 'high'}
        </Badge>
      )}
    </div>
  );
}
