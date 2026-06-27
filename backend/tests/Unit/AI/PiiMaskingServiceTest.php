<?php

declare(strict_types=1);

use App\Modules\AI\Services\PiiMaskingService;
use Illuminate\Support\Facades\Log;

beforeEach(function (): void {
    Log::spy();
});

it('drops top-level mobile, email, token, address, phone, password', function (): void {
    $svc = new PiiMaskingService;

    $out = $svc->mask([
        'mobile' => '+91 9876543210',
        'email' => 'citizen@example.com',
        'token' => 'eyJhbGciOiJIUzI1NiJ9.x.y',
        'address' => '123 MG Road, Bangalore',
        'phone' => '080-12345678',
        'password' => 'hunter2',
        'title' => 'Pothole',
    ]);

    expect($out)->toHaveKey('title')
        ->and($out)->not->toHaveKey('mobile')
        ->and($out)->not->toHaveKey('email')
        ->and($out)->not->toHaveKey('token')
        ->and($out)->not->toHaveKey('address')
        ->and($out)->not->toHaveKey('phone')
        ->and($out)->not->toHaveKey('password');
});

it('drops the same keys at any nesting depth', function (): void {
    $svc = new PiiMaskingService;

    $out = $svc->mask([
        'citizen' => [
            'name' => 'Anonymous',
            'mobile' => '9876543210',
            'email' => 'a@b.com',
        ],
        'meta' => [
            'audit' => [
                'token' => 'leaked-token',
            ],
        ],
    ]);

    expect($out['citizen'])->toHaveKey('name')
        ->and($out['citizen'])->not->toHaveKey('mobile')
        ->and($out['citizen'])->not->toHaveKey('email')
        ->and($out['meta']['audit'])->not->toHaveKey('token');
});

it('rounds latitude/longitude to 2 decimals (≈1.1 km grid)', function (): void {
    $svc = new PiiMaskingService;

    $out = $svc->mask([
        'latitude' => 12.97159876543,
        'longitude' => 77.59456234567,
    ]);

    expect($out['latitude'])->toBe(12.97)
        ->and($out['longitude'])->toBe(77.59);
});

it('masks 10-digit Indian mobile numbers embedded in free text', function (): void {
    $svc = new PiiMaskingService;

    $out = $svc->mask([
        'description' => 'Call 9876543210 if you see the contractor again.',
    ]);

    expect($out['description'])->not->toContain('9876543210')
        ->and($out['description'])->toContain('**********');
});

it('does not mutate the input array', function (): void {
    $svc = new PiiMaskingService;
    $input = [
        'mobile' => '9876543210',
        'meta' => ['email' => 'a@b.com'],
    ];
    $snapshot = json_encode($input);

    $svc->mask($input);

    expect(json_encode($input))->toBe($snapshot);
});

it('logs a pii.masked event with the key summary', function (): void {
    $svc = new PiiMaskingService;

    $svc->mask(['mobile' => 'x', 'title' => 'Pothole']);

    Log::shouldHaveReceived('info')->withArgs(function (string $msg, array $ctx): bool {
        return $msg === 'pii.masked'
            && isset($ctx['keys_before'], $ctx['keys_after']);
    });
});

it('preserves non-PII keys verbatim (whitelisted shape)', function (): void {
    $svc = new PiiMaskingService;

    $out = $svc->mask([
        'title' => 'Pothole on MG Road',
        'description' => 'Large pothole in the right lane.',
        'category' => 'pothole',
        'severity' => 'high',
        'ward' => 'mg-road',
    ]);

    expect($out['title'])->toBe('Pothole on MG Road')
        ->and($out['description'])->toBe('Large pothole in the right lane.')
        ->and($out['category'])->toBe('pothole')
        ->and($out['severity'])->toBe('high')
        ->and($out['ward'])->toBe('mg-road');
});
