<?php

declare(strict_types=1);

use App\Modules\AI\Models\AiProviderConfig;
use App\Modules\AI\Models\PromptVersion;
use Database\Seeders\AiProvidersSeeder;
use Database\Seeders\PromptsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

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

it('PromptsSeeder inserts the phase one category prompt and the two base v1 prompts', function (): void {
    (new PromptsSeeder)->run();

    $names = ['category_classifier', 'severity_estimator', 'ai_labeller'];

    $category = PromptVersion::query()->where('name', 'category_classifier')->where('version', 6)->first();
    expect($category)->not->toBeNull()
        ->and($category->status)->toBe(PromptVersion::STATUS_APPROVED)
        ->and($category->prompt_text)->toContain('image is authoritative evidence')
        ->and($category->prompt_text)->toContain('emergency_flag')
        ->and($category->prompt_text)->toContain('secondary_triggers')
        ->and($category->expected_json_schema['required'])->toContain('emergency_flag')
        ->and($category->expected_json_schema['required'])->toContain('secondary_triggers');

    foreach (['severity_estimator', 'ai_labeller'] as $name) {
        $p = PromptVersion::query()->where('name', $name)->where('version', 1)->first();
        expect($p)->not->toBeNull("missing prompt: {$name}")
            ->and($p->status)->toBe(PromptVersion::STATUS_APPROVED);
    }

    expect(PromptVersion::query()->whereIn('name', $names)->count())->toBe(3);
});

it('PromptsSeeder is idempotent (re-running does not duplicate rows)', function (): void {
    (new PromptsSeeder)->run();
    (new PromptsSeeder)->run();

    expect(PromptVersion::query()->count())->toBe(3);
});
