import type { ReactNode } from 'react';
import {
  IconAlertTriangle,
  IconBrain,
  IconCar,
  IconCheck,
  IconInfoCircle,
  IconNote,
  IconPhotoSearch,
  IconRoute,
  IconShieldCheck,
  IconSparkles,
  IconTag,
} from '@tabler/icons-react';
import type { AiResult, ReportStatusCode } from '../types';

type Tone = 'neutral' | 'success' | 'warning' | 'danger';

function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${Math.round(n)}%`;
}

function mockGpsPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${Math.round(n * 100)}%`;
}

function unitPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${Math.round(n * 100)}%`;
}

function riskTone(n: number | null | undefined, threshold = 60): Tone {
  if (n === null || n === undefined) return 'neutral';
  if (n >= threshold + 20) return 'danger';
  if (n >= threshold) return 'warning';
  return 'success';
}

function qualityTone(n: number | null | undefined): Tone {
  if (n === null || n === undefined) return 'neutral';
  if (n >= 80) return 'success';
  if (n >= 60) return 'warning';
  return 'danger';
}

function confidenceTone(n: number | null | undefined): Tone {
  if (n === null || n === undefined) return 'neutral';
  if (n >= 95) return 'success';
  if (n >= 80) return 'warning';
  return 'danger';
}

function confidenceStatus(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'Unavailable';
  if (n >= 95) return 'Auto-route eligible';
  if (n >= 80) return 'Moderator review';
  return 'Manual classification';
}

const reviewReasonCopy: Record<string, string> = {
  classification_review:
    'The suggested category needs your review before this complaint is sent to a department.',
  manual_classification: 'Classification confidence requires manual classification.',
  evidence_mismatch: 'The submitted description may not match the visual evidence.',
  duplicate_risk: 'Possible duplicate or reused evidence was detected.',
  misrepresentation_risk: 'Misrepresentation signals are above the review threshold.',
  synthetic_media_risk: 'The image may be synthetic or AI-generated.',
  location_risk: 'The submitted location requires verification.',
};

const securityReviewReasons = new Set([
  'evidence_mismatch',
  'duplicate_risk',
  'misrepresentation_risk',
  'synthetic_media_risk',
  'location_risk',
]);

function inferReviewReasons(ai: AiResult, mockGpsScore?: number | null): string[] {
  const reasons: string[] = [];

  if (ai.confidence < 80) reasons.push('manual_classification');
  else if (ai.confidence < 95) reasons.push('classification_review');

  if (ai.claim_matches_evidence === false || (ai.consistency_score ?? 100) < 50) {
    reasons.push('evidence_mismatch');
  }
  if (ai.duplicate_score >= 60) reasons.push('duplicate_risk');
  if (ai.fraud_score >= 60) reasons.push('misrepresentation_risk');
  if ((ai.synthetic_score ?? 0) >= 0.5) reasons.push('synthetic_media_risk');
  if ((mockGpsScore ?? 0) >= 0.6) reasons.push('location_risk');

  return reasons;
}

const toneStyles: Record<
  Tone,
  { background: string; border: string; icon: string; label: string }
> = {
  neutral: {
    background: 'bg-[#f3f2ed]',
    border: 'border-[#a8a7a1]',
    icon: 'text-[#777670]',
    label: 'Unavailable',
  },
  success: {
    background: 'bg-[#edf7f0]',
    border: 'border-[#3f8a60]',
    icon: 'text-[#256b45]',
    label: 'Clear',
  },
  warning: {
    background: 'bg-[#fff6e4]',
    border: 'border-[#b9822b]',
    icon: 'text-[#805913]',
    label: 'Review',
  },
  danger: {
    background: 'bg-[#fbeeed]',
    border: 'border-[#c6534c]',
    icon: 'text-[#9f3731]',
    label: 'High risk',
  },
};

export interface AiAnalysisPanelProps {
  ai: AiResult | null;
  statusCode?: ReportStatusCode;
  mockGpsScore?: number | null;
}

export function AiAnalysisPanel({ ai, statusCode, mockGpsScore }: AiAnalysisPanelProps) {
  if (!ai) {
    const message =
      statusCode === 'submitted' || statusCode === 'ai_processing'
        ? 'AI analysis is queued or still processing. This can take a few minutes while the vision provider completes the review.'
        : 'No AI result is available for this complaint.';

    return (
      <section className="rounded-xl bg-white p-4" aria-labelledby="ai-analysis-title">
        <PanelHeader subtitle="Processing status" />
        <p className="mt-4 text-sm leading-6 text-[#6f6e69]">{message}</p>
        {mockGpsScore !== null && mockGpsScore !== undefined && (
          <div className="mt-4">
            <Metric
              icon={<IconRoute className="h-4 w-4" stroke={1.7} />}
              label="Location risk"
              value={mockGpsPct(mockGpsScore)}
              tone={riskTone(mockGpsScore * 100)}
            />
          </div>
        )}
      </section>
    );
  }

  const reviewReasons = ai.review_reasons ?? inferReviewReasons(ai, mockGpsScore);
  const reviewRequired = ai.review_required ?? reviewReasons.length > 0;
  const hasSecurityRisk = reviewReasons.some((reason) => securityReviewReasons.has(reason));

  return (
    <section className="rounded-xl bg-white p-4" aria-labelledby="ai-analysis-title">
      <PanelHeader subtitle={`${ai.provider_code} · Prompt v${ai.prompt_version}`} />

      <div className="mt-4 rounded-lg bg-[#f3f2ed] px-4 py-3.5 ring-1 ring-[#1d1d1b]">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6f6e69]">
          Recommended routing
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[#1d1d1b]">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <IconTag className="h-4 w-4" stroke={1.8} />
            {ai.recommended_category?.name ?? 'No category'}
          </span>
          <span aria-hidden className="text-[#aaa9a4]">
            /
          </span>
          <span className="text-sm font-medium text-[#4f4e4a]">
            {ai.recommended_department?.name ?? 'No department'}
          </span>
        </div>
      </div>

      {ai.notes && (
        <div className="mt-4 rounded-lg bg-[#fff7e7] px-4 py-4 ring-1 ring-[#e7b75d]">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a5b0b]">
              <IconNote className="h-4 w-4" stroke={1.8} />
              AI notes — read before deciding
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e7b75d] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#3a2c08]">
              Important
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#5a4510]">{ai.notes}</p>
        </div>
      )}

      {reviewRequired && (
        <div
          role="status"
          className={`mt-4 border-l-2 px-4 py-3 ${
            hasSecurityRisk
              ? 'border-[#c6534c] bg-[#fbeeed] text-[#72231f]'
              : 'border-[#b9822b] bg-[#fff6e4] text-[#66470f]'
          }`}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <IconAlertTriangle className="h-4 w-4 shrink-0" stroke={1.8} />
            Moderator review required
          </p>
          {reviewReasons.length > 0 && (
            <ul className="mt-2 space-y-1 pl-6 text-xs leading-5">
              {reviewReasons.map((reason) => (
                <li key={reason} className="list-disc">
                  {reviewReasonCopy[reason] ?? 'An AI review signal requires verification.'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Metric
          icon={<IconShieldCheck className="h-4 w-4" stroke={1.7} />}
          label="Classification confidence"
          value={pct(ai.confidence)}
          tone={confidenceTone(ai.confidence)}
          statusLabel={confidenceStatus(ai.confidence)}
        />
        <Metric
          icon={<IconInfoCircle className="h-4 w-4" stroke={1.7} />}
          label="Description match"
          value={pct(ai.consistency_score)}
          tone={qualityTone(ai.consistency_score)}
        />
        <Metric
          icon={<IconAlertTriangle className="h-4 w-4" stroke={1.7} />}
          label="Duplicate risk"
          value={pct(ai.duplicate_score)}
          tone={riskTone(ai.duplicate_score)}
        />
        <Metric
          icon={<IconShieldCheck className="h-4 w-4" stroke={1.7} />}
          label="Misrepresentation risk"
          value={pct(ai.fraud_score)}
          tone={riskTone(ai.fraud_score)}
        />
        {mockGpsScore !== null && mockGpsScore !== undefined && (
          <Metric
            icon={<IconRoute className="h-4 w-4" stroke={1.7} />}
            label="Location risk"
            value={mockGpsPct(mockGpsScore)}
            tone={riskTone(mockGpsScore * 100)}
          />
        )}
        {ai.synthetic_score !== null && ai.synthetic_score !== undefined && (
          <Metric
            icon={<IconSparkles className="h-4 w-4" stroke={1.7} />}
            label="Synthetic media"
            value={unitPct(ai.synthetic_score)}
            tone={riskTone(ai.synthetic_score * 100)}
          />
        )}
        <Metric
          icon={<IconPhotoSearch className="h-4 w-4" stroke={1.7} />}
          label="Image quality"
          value={pct(ai.quality_score)}
          tone={qualityTone(ai.quality_score)}
        />
      </div>

      {ai.claim_matches_evidence === false && (
        <div className="mt-4 border-l-2 border-[#c53d35] bg-[#f9eceb] px-3 py-2.5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#a42f29]">
            <IconAlertTriangle className="h-4 w-4" stroke={1.8} />
            Evidence mismatch
          </p>
          <p className="mt-1 text-sm leading-5 text-[#72231f]">
            {ai.mismatch_reason ||
              'The visual evidence does not support the submitted title or description.'}
          </p>
        </div>
      )}

      {ai.labels.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8f9089]">
            Detected labels
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {ai.labels.map((label) => (
              <li
                key={label.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#d0cec8] bg-[#f3f2ed] px-2 py-1 text-xs text-[#343431]"
              >
                <IconCheck className="h-3 w-3 text-[#226b46]" stroke={2} />
                {label.name}
                <span className="font-mono text-[#777670]">{label.confidence.toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ai.license_plate && (
        <div className="mt-4 border-l-2 border-[#c98a20] bg-[#fff7e7] px-3 py-3">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a5b0b]">
            <IconCar className="h-4 w-4" stroke={1.7} />
            License plate detected
          </p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-xl font-semibold tracking-[0.12em] text-[#1d1d1b]">
              {ai.license_plate}
            </span>
            {ai.plate_confidence !== null && ai.plate_confidence !== undefined && (
              <span className="text-xs text-[#6f6e69]">
                {Math.round(ai.plate_confidence * 100)}% confidence
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#765b29]">Verify against the evidence before acting.</p>
        </div>
      )}
    </section>
  );
}

function PanelHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#1d1d1b] text-white">
        <IconBrain className="h-5 w-5" stroke={1.8} />
      </span>
      <div>
        <h2 id="ai-analysis-title" className="text-sm font-semibold text-[#1d1d1b]">
          AI Analysis
        </h2>
        <p className="mt-0.5 text-xs text-[#777670]">{subtitle}</p>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
  statusLabel,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: Tone;
  statusLabel?: string;
}) {
  const styles = toneStyles[tone];

  return (
    <div className={`min-h-24 rounded-r-lg border-l-2 p-3 ${styles.background} ${styles.border}`}>
      <div className={`flex items-center gap-1.5 ${styles.icon}`}>
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em]">{label}</p>
      </div>
      <p className="mt-2 text-xl font-semibold text-[#1d1d1b]">{value}</p>
      <p className={`mt-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${styles.icon}`}>
        {statusLabel ?? styles.label}
      </p>
    </div>
  );
}
