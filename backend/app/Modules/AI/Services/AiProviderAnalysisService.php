<?php

declare(strict_types=1);

namespace App\Modules\AI\Services;

use App\Modules\AI\ValueObjects\AiAnalysisOutcome;
use App\Modules\AI\ValueObjects\AiRequest;
use App\Modules\AI\ValueObjects\AiResponse;
use App\Modules\Media\Models\Media;
use App\Modules\Reports\Models\Report;
use App\Modules\Settings\Services\FeatureFlagService;
use App\Modules\Users\Models\User;
use Illuminate\Support\Collection;

final class AiProviderAnalysisService
{
    public function __construct(
        private readonly ProviderFailoverService $failover,
        private readonly AiResponseValidator $validator,
        private readonly ImageQualityAnalyzer $quality,
        private readonly PiiMaskingService $pii,
        private readonly FeatureFlagService $flags,
        private readonly AiMediaReferenceResolver $mediaReferences,
        private readonly AiRiskAnalyzer $risk,
        private readonly AiResponsePolicy $responsePolicy,
    ) {}

    /**
     * @param  Collection<int, Media>  $media
     */
    public function analyze(Report $report, Collection $media, ?User $actor): AiAnalysisOutcome
    {
        $qualityScores = $media->map(fn (Media $asset): int => $this->quality->score($asset));
        $qualityMinimum = $qualityScores->min();
        $qualityScore = is_numeric($qualityMinimum) ? (int) $qualityMinimum : 0;
        $visionMedia = $media->where('type', 'PHOTO')->values();

        $maskedResult = $this->pii->mask([
            'text' => $report->title."\n".$report->description."\n",
        ]);
        $maskedText = is_string($maskedResult['text'] ?? null) ? $maskedResult['text'] : '';
        $maskedMetadata = $this->pii->mask([
            'ward' => null,
            'district' => null,
        ]);

        if ($visionMedia->isEmpty()) {
            $response = $this->responsePolicy->videoReview($qualityScore);
            $providerCode = 'video-review';
            $model = 'deterministic-video-routing';
        } elseif ($this->quality->shouldFlagForModerator($qualityScore)) {
            $response = $this->responsePolicy->lowQuality($qualityScore);
            $providerCode = 'quality-gate';
            $model = 'deterministic-image-quality';
        } else {
            $request = new AiRequest(
                promptName: 'category_classifier',
                mediaUrls: $visionMedia
                    ->map(fn (Media $asset): string => $this->mediaReferences->resolve($asset))
                    ->all(),
                mediaTypes: $visionMedia
                    ->map(static fn (Media $asset): string => $asset->mime)
                    ->all(),
                text: $maskedText,
                metadata: $maskedMetadata,
            );
            [$response, $providerCode, $model] = $this->classify($request, $actor);
            $response = $this->responsePolicy->normalizeClaimMatch($response);
            $response = $this->responsePolicy->capUnverifiedParkingZoneClaim($response, $report);
        }

        $risk = $this->risk->analyze($report, $response, $actor);
        $effectiveQualityScore = $this->responsePolicy->effectiveQualityScore($qualityScore, $response);
        $confidence = min($response->confidence, $effectiveQualityScore / 100);
        $confidence = $this->responsePolicy->calibrateConfidence($confidence, $response);

        return new AiAnalysisOutcome(
            response: $response,
            qualityScore: $effectiveQualityScore,
            duplicateScore: $risk->duplicateScore,
            fraudScore: $risk->fraudScore,
            confidence: $confidence,
            providerCode: $providerCode,
            model: $model,
        );
    }

    /**
     * @return array{0: AiResponse, 1: string, 2: string}
     */
    private function classify(AiRequest $request, ?User $actor): array
    {
        if (! $this->flags->enabled('ai_enabled', $actor)) {
            return [$this->responsePolicy->disabled(), 'disabled', 'n/a'];
        }

        $response = $this->failover->execute($request);
        $this->validator->validate($response);

        return [
            $response,
            $this->failover->lastUsedProvider->code ?? 'unknown',
            $this->failover->lastUsedProvider->model ?? 'unknown',
        ];
    }
}
