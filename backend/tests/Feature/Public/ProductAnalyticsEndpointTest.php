<?php

declare(strict_types=1);

use App\Modules\Public\Models\ProductAnalyticsEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('accepts an allowlisted product event without authentication', function (): void {
    $this->postJson('/api/v1/public/analytics/events', [
        'event_code' => 'report_step_viewed',
        'properties' => ['step' => 'Location'],
    ])->assertStatus(202)->assertJsonPath('data.accepted', true);
});

it('rejects unknown event codes', function (): void {
    $this->postJson('/api/v1/public/analytics/events', ['event_code' => 'user_email'])->assertStatus(422);
});

it('does not persist sensitive property keys', function (): void {
    $this->postJson('/api/v1/public/analytics/events', [
        'event_code' => 'report_completed',
        'properties' => ['email' => 'citizen@example.test', 'step' => 'Review'],
    ])->assertStatus(202);

    $this->assertDatabaseHas('product_analytics_events', [
        'event_code' => 'report_completed',
    ]);
    expect(ProductAnalyticsEvent::query()->firstOrFail()->properties)->toBe(['step' => 'Review']);
});
