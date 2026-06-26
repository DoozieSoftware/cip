<?php

declare(strict_types=1);

use App\Modules\Settings\Models\AppConfig;
use Database\Seeders\AppConfigsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('seeds all 10 default feature flags from docs/09 §18', function (): void {
    (new AppConfigsSeeder)->run();

    expect(AppConfig::query()->count())->toBe(10);

    foreach ([
        'anonymous_reporting',
        'ai_enabled',
        'ocr_enabled',
        'video_mandatory',
        'moderator_required',
        'public_dashboard',
        'offline_mode',
        'push_notifications',
        'fraud_detection',
        'duplicate_detection',
    ] as $key) {
        expect(AppConfig::query()->where('key', $key)->exists())->toBeTrue("missing flag: {$key}");
    }
});

it('defaults match the docs — most flags on, video_mandatory off', function (): void {
    (new AppConfigsSeeder)->run();

    $videoMandatory = AppConfig::query()->where('key', 'video_mandatory')->firstOrFail();
    $moderatorRequired = AppConfig::query()->where('key', 'moderator_required')->firstOrFail();
    $anonymous = AppConfig::query()->where('key', 'anonymous_reporting')->firstOrFail();

    expect($videoMandatory->enabled)->toBeFalse()
        ->and($videoMandatory->rollout_percentage)->toBe(0)
        ->and($moderatorRequired->enabled)->toBeTrue()
        ->and($moderatorRequired->rollout_percentage)->toBe(100)
        ->and($anonymous->enabled)->toBeTrue();
});

it('preserves the JSON `value` payload (providers / threshold / etc.)', function (): void {
    (new AppConfigsSeeder)->run();

    $ai = AppConfig::query()->where('key', 'ai_enabled')->firstOrFail();
    $fraud = AppConfig::query()->where('key', 'fraud_detection')->firstOrFail();

    expect($ai->value)->toBeArray()
        ->and($ai->value['providers'] ?? null)->toBe(['local'])
        ->and($fraud->value['threshold'] ?? null)->toBe(0.85);
});

it('is idempotent — a second run does not duplicate rows', function (): void {
    (new AppConfigsSeeder)->run();
    (new AppConfigsSeeder)->run();

    expect(AppConfig::query()->count())->toBe(10);
});
