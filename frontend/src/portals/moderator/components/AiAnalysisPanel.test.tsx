import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AiResult } from '../types';
import { AiAnalysisPanel } from './AiAnalysisPanel';

function aiResult(overrides: Partial<AiResult> = {}): AiResult {
  return {
    job_id: 'job-1',
    provider_code: 'openai-compatible',
    prompt_version: 4,
    confidence: 90,
    review_required: true,
    review_reasons: ['classification_review', 'duplicate_risk', 'misrepresentation_risk'],
    recommended_category: { id: 'type-1', code: 'roads', name: 'Roads' },
    recommended_department: { id: 'dept-1', code: 'GBA', name: 'Greater Bengaluru Authority' },
    labels: [],
    fraud_score: 100,
    duplicate_score: 100,
    quality_score: 90,
    notes: null,
    license_plate: null,
    plate_confidence: null,
    claim_matches_evidence: true,
    consistency_score: 100,
    mismatch_reason: null,
    synthetic_score: 0,
    created_at: '2026-08-17T12:00:00Z',
    ...overrides,
  };
}

describe('AiAnalysisPanel', () => {
  it('separates classification confidence from the overall review verdict', () => {
    render(<AiAnalysisPanel ai={aiResult()} />);

    expect(screen.getByText('Moderator review required')).toBeInTheDocument();
    expect(screen.getByText('Classification confidence')).toBeInTheDocument();
    expect(screen.getByText('Moderator review')).toBeInTheDocument();
    expect(screen.getAllByText('100%')).toHaveLength(3);
    expect(
      screen.getByText(
        'The suggested category needs your review before this report is sent to a department.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/auto-route threshold/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Possible duplicate or reused evidence/)).toBeInTheDocument();
  });

  it('shows high confidence as auto-route eligible only when no review gate is raised', () => {
    render(
      <AiAnalysisPanel
        ai={aiResult({
          confidence: 98,
          review_required: false,
          review_reasons: [],
          duplicate_score: 5,
          fraud_score: 10,
        })}
      />,
    );

    expect(screen.queryByText('Moderator review required')).not.toBeInTheDocument();
    expect(screen.getByText('Auto-route eligible')).toBeInTheDocument();
  });

  it('renders unit-scale synthetic media confidence as a percentage', () => {
    render(<AiAnalysisPanel ai={aiResult({ synthetic_score: 0.9 })} />);

    expect(screen.getAllByText('90%')).toHaveLength(3);
  });

  it('infers the review verdict when the API is upgraded after the frontend', () => {
    render(
      <AiAnalysisPanel
        ai={aiResult({ review_required: undefined, review_reasons: undefined, fraud_score: 10 })}
      />,
    );

    expect(screen.getByText('Moderator review required')).toBeInTheDocument();
    expect(screen.getByText(/Possible duplicate or reused evidence/)).toBeInTheDocument();
  });
});
