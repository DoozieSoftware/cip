<?php

declare(strict_types=1);

use App\Modules\AI\Contracts\AIProviderInterface;
use App\Modules\AI\Models\AiProviderConfig;
use App\Modules\AI\Services\ProviderFailoverService;
use App\Modules\AI\ValueObjects\AiRequest;
use App\Modules\AI\ValueObjects\AiResponse;
use Illuminate\Support\Str;

beforeEach(function (): void {
    // No master data required for this test — we build provider rows directly.
});

function makeConfig(array $overrides = []): AiProviderConfig
{
    return AiProviderConfig::query()->create(array_merge([
        'code' => strtolower(Str::random(8)),
        'name' => 'X',
        'base_url' => 'https://example.com',
        'auth_type' => 'bearer',
        'model' => 'm',
        'temperature' => 0.2,
        'timeout_ms' => 5000,
        'retry_count' => 1,
        'is_fallback' => false,
        'priority' => 100,
        'active' => true,
    ], $overrides));
}

it('first provider succeeds on the first attempt', function (): void {
    $cfgA = makeConfig(['code' => 'pa', 'priority' => 10, 'is_fallback' => false]);
    $cfgB = makeConfig(['code' => 'pb', 'priority' => 20, 'is_fallback' => true]);

    $svc = new ProviderFailoverService(bindings: [
        'pa' => new class implements AIProviderInterface
        {
            public function getName(): string
            {
                return 'pa';
            }

            public function getModel(): string
            {
                return 'm';
            }

            public function healthCheck(): bool
            {
                return true;
            }

            public function classify(AiRequest $r): AiResponse
            {
                return new AiResponse(
                    labels: [['label' => 'pothole', 'confidence' => 0.9, 'is_primary' => true]],
                    predictedType: 'pothole',
                    confidence: 0.9,
                    recommendedDepartment: 'public_works',
                    severity: 'high',
                    qualityScore: 80,
                    duplicateScore: 0,
                    fraudScore: 0,
                    summary: 'x',
                );
            }
        },
        'pb' => new class implements AIProviderInterface
        {
            public function getName(): string
            {
                return 'pb';
            }

            public function getModel(): string
            {
                return 'm';
            }

            public function healthCheck(): bool
            {
                return true;
            }

            public function classify(AiRequest $r): AiResponse
            {
                $this->fail('pb should not be called when pa succeeds');
            }
        },
    ]);

    $resp = $svc->execute(new AiRequest(promptName: 'category_classifier'));

    expect($resp->primaryLabel())->toBe('pothole')
        ->and($resp->severity)->toBe('high');
});

it('first provider throws on every attempt → falls over to the second provider', function (): void {
    $cfgA = makeConfig(['code' => 'pa', 'priority' => 10, 'retry_count' => 2]);
    $cfgB = makeConfig(['code' => 'pb', 'priority' => 20, 'is_fallback' => true, 'retry_count' => 1]);

    $svc = new ProviderFailoverService(bindings: [
        'pa' => new class implements AIProviderInterface
        {
            public int $calls = 0;

            public function getName(): string
            {
                return 'pa';
            }

            public function getModel(): string
            {
                return 'm';
            }

            public function healthCheck(): bool
            {
                return true;
            }

            public function classify(AiRequest $r): AiResponse
            {
                $this->calls++;

                throw new RuntimeException('pa 503');
            }
        },
        'pb' => new class implements AIProviderInterface
        {
            public function getName(): string
            {
                return 'pb';
            }

            public function getModel(): string
            {
                return 'm';
            }

            public function healthCheck(): bool
            {
                return true;
            }

            public function classify(AiRequest $r): AiResponse
            {
                return new AiResponse(
                    labels: [['label' => 'fallback', 'confidence' => 0.5, 'is_primary' => true]],
                    predictedType: 'fallback',
                    confidence: 0.5,
                    recommendedDepartment: 'public_works',
                    severity: 'low',
                    qualityScore: 50,
                    duplicateScore: 0,
                    fraudScore: 0,
                    summary: 'pb succeeded',
                );
            }
        },
    ]);

    $resp = $svc->execute(new AiRequest(promptName: 'category_classifier'));

    expect($resp->primaryLabel())->toBe('fallback')
        ->and($resp->summary)->toBe('pb succeeded');
});

it('retries within the same provider up to retry_count before moving on', function (): void {
    $cfgA = makeConfig(['code' => 'pa', 'priority' => 10, 'retry_count' => 3]);
    $cfgB = makeConfig(['code' => 'pb', 'priority' => 20, 'is_fallback' => true, 'retry_count' => 1]);

    $tracker = new class implements AIProviderInterface
    {
        public int $calls = 0;

        public function getName(): string
        {
            return 'pa';
        }

        public function getModel(): string
        {
            return 'm';
        }

        public function healthCheck(): bool
        {
            return true;
        }

        public function classify(AiRequest $r): AiResponse
        {
            $this->calls++;

            throw new RuntimeException('pa 503');
        }
    };

    $svc = new ProviderFailoverService(bindings: [
        'pa' => $tracker,
        'pb' => new class implements AIProviderInterface
        {
            public function getName(): string
            {
                return 'pb';
            }

            public function getModel(): string
            {
                return 'm';
            }

            public function healthCheck(): bool
            {
                return true;
            }

            public function classify(AiRequest $r): AiResponse
            {
                return new AiResponse(
                    labels: [['label' => 'fallback', 'confidence' => 0.5, 'is_primary' => true]],
                    predictedType: 'fallback',
                    confidence: 0.5,
                    recommendedDepartment: 'public_works',
                    severity: 'low',
                    qualityScore: 50,
                    duplicateScore: 0,
                    fraudScore: 0,
                    summary: 'pb ok',
                );
            }
        },
    ]);

    $svc->execute(new AiRequest(promptName: 'category_classifier'));

    expect($tracker->calls)->toBe(3);
});

it('throws when every provider fails', function (): void {
    $cfgA = makeConfig(['code' => 'pa', 'priority' => 10, 'retry_count' => 1]);
    $cfgB = makeConfig(['code' => 'pb', 'priority' => 20, 'is_fallback' => true, 'retry_count' => 1]);

    $svc = new ProviderFailoverService(bindings: [
        'pa' => new class implements AIProviderInterface
        {
            public function getName(): string
            {
                return 'pa';
            }

            public function getModel(): string
            {
                return 'm';
            }

            public function healthCheck(): bool
            {
                return true;
            }

            public function classify(AiRequest $r): AiResponse
            {
                throw new RuntimeException('pa down');
            }
        },
        'pb' => new class implements AIProviderInterface
        {
            public function getName(): string
            {
                return 'pb';
            }

            public function getModel(): string
            {
                return 'm';
            }

            public function healthCheck(): bool
            {
                return true;
            }

            public function classify(AiRequest $r): AiResponse
            {
                throw new RuntimeException('pb down');
            }
        },
    ]);

    expect(fn () => $svc->execute(new AiRequest(promptName: 'category_classifier')))
        ->toThrow(RuntimeException::class, 'all_providers_failed');
});

it('throws when no active providers are configured', function (): void {
    $svc = new ProviderFailoverService(bindings: []);

    expect(fn () => $svc->execute(new AiRequest(promptName: 'category_classifier')))
        ->toThrow(RuntimeException::class, 'no_active_provider_configured');
});

it('preferred_code pins the resolver to a single provider', function (): void {
    $cfgA = makeConfig(['code' => 'pa', 'priority' => 10, 'retry_count' => 1, 'is_fallback' => false]);
    $cfgB = makeConfig(['code' => 'pb', 'priority' => 99, 'retry_count' => 1, 'is_fallback' => true]);

    $calls = ['pa' => 0, 'pb' => 0];

    $svc = new ProviderFailoverService(bindings: [
        'pa' => new class($calls) implements AIProviderInterface
        {
            public function __construct(public array &$calls) {}

            public function getName(): string
            {
                return 'pa';
            }

            public function getModel(): string
            {
                return 'm';
            }

            public function healthCheck(): bool
            {
                return true;
            }

            public function classify(AiRequest $r): AiResponse
            {
                $this->calls['pa']++;

                return new AiResponse(
                    labels: [['label' => 'pa', 'confidence' => 0.5, 'is_primary' => true]],
                    predictedType: 'pa',
                    confidence: 0.5,
                    recommendedDepartment: 'public_works',
                    severity: 'low',
                    qualityScore: 50,
                    duplicateScore: 0,
                    fraudScore: 0,
                    summary: 'pa ok',
                );
            }
        },
        'pb' => new class($calls) implements AIProviderInterface
        {
            public function __construct(public array &$calls) {}

            public function getName(): string
            {
                return 'pb';
            }

            public function getModel(): string
            {
                return 'm';
            }

            public function healthCheck(): bool
            {
                return true;
            }

            public function classify(AiRequest $r): AiResponse
            {
                $this->calls['pb']++;

                return new AiResponse(
                    labels: [['label' => 'pb', 'confidence' => 0.5, 'is_primary' => true]],
                    predictedType: 'pb',
                    confidence: 0.5,
                    recommendedDepartment: 'public_works',
                    severity: 'low',
                    qualityScore: 50,
                    duplicateScore: 0,
                    fraudScore: 0,
                    summary: 'pb ok',
                );
            }
        },
    ]);

    // Pin to pa even though pb is is_fallback=true
    $resp = $svc->execute(new AiRequest(promptName: 'category_classifier'), preferredCode: 'pa');

    expect($resp->primaryLabel())->toBe('pa')
        ->and($calls['pa'])->toBe(1)
        ->and($calls['pb'])->toBe(0);
});
