<?php

declare(strict_types=1);

use App\Modules\AI\Models\AiProviderConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\AI\Models\PromptVersion;
use Database\Seeders\AiProvidersSeeder;
use Database\Seeders\PromptsSeeder;

uses(RefreshDatabase::class);


it('AiProvidersSeeder inserts mock as the highest-priority active provider', function (): void {
    (new AiProvidersSeeder)->run();

    $mock = AiProviderConfig::query()->where('code', 'mock')->first();
    expect($mock)->not->toBeNull()
        ->and($mock->active)->toBeTrue()
        ->and($mock->is_fallback)->toBeFalse()
        ->and($mock->priority)->toBeLessThan(100);

    $openai = AiProviderConfig::query()->where('code', 'openai')->first();
    expect($openai)->not->toBeNull()
        ->and($openai->active)->toBeFalse();

    $qwen = AiProviderConfig::query()->where('code', 'qwen-vl')->first();
    expect($qwen)->not->toBeNull()
        ->and($qwen->active)->toBeFalse()
        ->and($qwen->is_fallback)->toBeTrue();
});

it('AiProvidersSeeder is idempotent (re-running does not duplicate rows)', function (): void {
    (new AiProvidersSeeder)->run();
    (new AiProvidersSeeder)->run();

    expect(AiProviderConfig::query()->whereIn('code', ['mock', 'openai', 'qwen-vl'])->count())->toBe(3);
});

it('PromptsSeeder inserts the 3 base system prompts as approved v1', function (): void {
    (new PromptsSeeder)->run();

    $names = ['category_classifier', 'severity_estimator', 'ai_labeller'];

    foreach ($names as $name) {
        $p = PromptVersion::query()->where('name', $name)->where('version', 1)->first();
        expect($p)->not->toBeNull("missing prompt: {$name}")
            ->and($p->status)->toBe(PromptVersion::STATUS_APPROVED)
            ->and($p->provider_code)->toBe('mock');
    }

    expect(PromptVersion::query()->whereIn('name', $names)->count())->toBe(3);
});

it('PromptsSeeder is idempotent (re-running does not duplicate rows)', function (): void {
    (new PromptsSeeder)->run();
    (new PromptsSeeder)->run();

    expect(PromptVersion::query()->count())->toBe(3);
});
