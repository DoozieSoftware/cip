<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\AI\ValueObjects\AiResponse;
use App\Modules\AI\ValueObjects\AiRiskAssessment;
use App\Modules\Reports\Models\Report;
use App\Modules\Settings\Services\FeatureFlagService;
use App\Modules\Users\Models\User;

final class AiRiskAnalyzer
{
    public function __construct(
        private readonly DuplicateDetector $duplicates,
        private readonly FraudScorer $fraud,
        private readonly FeatureFlagService $flags,
    ) {}

    public function analyze(Report $report, AiResponse $response, ?User $actor): AiRiskAssessment
    {
        $duplicate = $this->flags->enabled('duplicate_detection', $actor)
            ? $this->duplicates->detect($report)
            : ['score' => 0, 'matched_report_id' => null, 'reason' => 'disabled'];

        $recentReports = $report->citizen_id === null
            ? 0
            : Report::query()
                ->where('citizen_id', $report->citizen_id)
                ->where('created_at', '>=', now()->subDay())
                ->count();
        $repeatedUploaderRisk = min(1.0, max(0, $recentReports - 5) / 5);

        $fraudScore = $this->flags->enabled('fraud_detection', $actor)
            ? $this->fraud->score($report, [
                'mock_gps' => (float) ($report->mock_gps_score ?? 0.0),
                'replay' => ((int) $duplicate['score']) / 100,
                'ai_synth' => $response->syntheticScore ?? 0.0,
                'repeated_device' => $repeatedUploaderRisk,
            ])
            : 0;

        if ($response->syntheticScore !== null && $response->syntheticScore >= 0.5) {
            $fraudScore = max($fraudScore, (int) round($response->syntheticScore * 100));
        }

        return new AiRiskAssessment((int) $duplicate['score'], $fraudScore);
    }
}
