<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\Reports\Models\Report;

/**
 * Fraud scorer (0–100) for incoming reports.
 *
 * Per docs/10 §21, the score aggregates the following
 * security signals (each 0..1; mapped to 0..100 internally
 * and combined with weights):
 *
 *  - mock_gps    : 0.40 weight — does the location look
 *                  fake (rounded coords, repeated emulator
 *                  pattern, or off-land position)
 *  - replay      : 0.25 weight — is the uploaded media
 *                  already in the media_hashes table from
 *                  a different reporter
 *  - ai_synth    : 0.20 weight — does the AI provider's
 *                  raw_response carry a synthetic-image
 *                  signal (provider-specific)
 *  - repeated_device : 0.10 weight — has this device /
 *                  uploader_id submitted more than 5
 *                  reports in the last 24h
 *  - rate_limit  : 0.05 weight — was the report rate-
 *                  limited (citizen: 60/min) before
 *                  reaching the orchestrator
 *
 * The combined score is clamped to 0..100. A score > 75
 * triggers the moderator review flag (the spec
 * boundary is 75; this constant is exposed).
 */
class FraudScorer
{
    public const FLAG_THRESHOLD = 75;

    /**
     * @param  array<string, float|bool>  $securityEvents  free-form signal bag
     */
    public function score(Report $report, array $securityEvents = []): int
    {
        $mockGps = (float) ($securityEvents['mock_gps'] ?? 0.0);
        $replay = (float) ($securityEvents['replay'] ?? 0.0);
        $aiSynth = (float) ($securityEvents['ai_synth'] ?? 0.0);
        $repeatedDevice = (float) ($securityEvents['repeated_device'] ?? 0.0);
        $rateLimit = (float) ($securityEvents['rate_limit'] ?? 0.0);

        $perSignal = [
            $mockGps * 100,
            $replay * 100,
            $aiSynth * 100,
            $repeatedDevice * 100,
            $rateLimit * 100,
        ];
        $weighted =
            ($mockGps * 0.40)
            + ($replay * 0.25)
            + ($aiSynth * 0.20)
            + ($repeatedDevice * 0.10)
            + ($rateLimit * 0.05);

        $score = (int) round(max(max($perSignal), $weighted * 100));

        return max(0, min(100, $score));
    }

    public function shouldFlagForModerator(int $score): bool
    {
        return $score > self::FLAG_THRESHOLD;
    }
}
