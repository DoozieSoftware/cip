import type { AiResult } from '../types';
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

export function AiAnalysisPanel({ ai }: { ai: AiResult | null }) {
  if (!ai) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Analysis</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-slate-500">No AI result yet — the M8 vision pipeline has not run for this report.</p>
        </CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Analysis</CardTitle>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Provider: <code className="rounded bg-slate-100 px-1">{ai.provider_code}</code></span>
          <span>Prompt v{ai.prompt_version}</span>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Confidence" value={pct(ai.confidence)} />
          <Stat label="Fraud score" value={pct(ai.fraud_score)} tone={scoreTone(ai.fraud_score)} />
          <Stat label="Duplicate score" value={pct(ai.duplicate_score)} tone={scoreTone(ai.duplicate_score)} />
          <Stat label="Quality" value={pct(ai.quality_score)} />
        </div>

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Recommendation</p>
          <p className="text-sm text-slate-800">
            Category: <strong>{ai.recommended_category?.name ?? '—'}</strong> · Department:{' '}
            <strong>{ai.recommended_department?.name ?? '—'}</strong>
          </p>
        </div>

        {ai.labels.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Labels</p>
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      {tone && tone !== 'neutral' && (
        <Badge tone={tone}>{tone === 'success' ? 'ok' : tone === 'warning' ? 'review' : 'high'}</Badge>
      )}
    </div>
  );
}
