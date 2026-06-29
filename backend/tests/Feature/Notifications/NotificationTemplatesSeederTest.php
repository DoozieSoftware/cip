<?php

declare(strict_types=1);

use App\Modules\Notifications\Models\NotificationTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Database\Seeders\NotificationTemplatesSeeder;

uses(RefreshDatabase::class);


it('inserts the default templates (>= 5)', function (): void {
    (new NotificationTemplatesSeeder)->run();

    expect(NotificationTemplate::query()->count())->toBeGreaterThanOrEqual(5);
});

it('creates templates for the canonical event codes', function (): void {
    (new NotificationTemplatesSeeder)->run();

    foreach (['report.assigned', 'report.status_changed', 'ai.classified', 'security.alert'] as $code) {
        expect(NotificationTemplate::query()->where('code', $code)->where('active', true)->exists())->toBeTrue();
    }
});

it('covers at least one row per supported channel', function (): void {
    (new NotificationTemplatesSeeder)->run();

    foreach (['email', 'sms', 'webhook'] as $channel) {
        expect(NotificationTemplate::query()->where('channel', $channel)->exists())->toBeTrue();
    }
});

it('is idempotent (re-running does not duplicate)', function (): void {
    (new NotificationTemplatesSeeder)->run();
    $count = NotificationTemplate::query()->count();
    (new NotificationTemplatesSeeder)->run();
    expect(NotificationTemplate::query()->count())->toBe($count);
});

it('marks every row as active and version 1', function (): void {
    (new NotificationTemplatesSeeder)->run();

    $rows = NotificationTemplate::query()->get();

    foreach ($rows as $r) {
        expect($r->active)->toBeTrue()
            ->and((int) $r->version)->toBe(1)
            ->and($r->locale)->toBe('en');
    }
});

it('declares the variables used in the body', function (): void {
    (new NotificationTemplatesSeeder)->run();

    $tpl = NotificationTemplate::query()->where('code', 'report.assigned')->where('channel', 'email')->first();
    expect($tpl)->not->toBeNull();
    $body = (string) $tpl->body;

    foreach ((array) $tpl->variables as $v) {
        expect($body)->toContain('{'.$v.'}');
    }
});
