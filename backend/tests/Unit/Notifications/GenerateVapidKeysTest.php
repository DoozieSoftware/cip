<?php

declare(strict_types=1);
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

uses(TestCase::class);

/**
 * The `notifications:vapid` command mints an EC P-256 keypair for
 * Web Push and prints it as base64url. These tests assert the
 * command succeeds and that both keys have the VAPID wire shape:
 * a 65-byte uncompressed public point (0x04 || X || Y) and a
 * 32-byte private scalar.
 */
function base64UrlDecode(string $value): string
{
    return (string) base64_decode(strtr($value, '-_', '+/'), true);
}

it('generates a VAPID keypair and exits successfully', function (): void {
    $exitCode = Artisan::call('notifications:vapid');
    $output = Artisan::output();

    expect($exitCode)->toBe(0)
        ->and($output)->toContain('VAPID_PUBLIC_KEY=')
        ->and($output)->toContain('VAPID_PRIVATE_KEY=');
});

it('emits base64url keys with the correct decoded byte lengths', function (): void {
    Artisan::call('notifications:vapid');
    $output = Artisan::output();

    $publicMatched = preg_match('/VAPID_PUBLIC_KEY=(\S+)/', $output, $public) === 1;
    $privateMatched = preg_match('/VAPID_PRIVATE_KEY=(\S+)/', $output, $private) === 1;

    expect($publicMatched)->toBeTrue()
        ->and($privateMatched)->toBeTrue();

    $publicBytes = base64UrlDecode($public[1] ?? '');
    $privateBytes = base64UrlDecode($private[1] ?? '');

    // Uncompressed EC point: 0x04 marker + 32-byte X + 32-byte Y.
    expect(strlen($publicBytes))->toBe(65)
        ->and(ord($publicBytes[0]))->toBe(0x04)
        ->and(strlen($privateBytes))->toBe(32);
});

it('produces a fresh keypair on each invocation', function (): void {
    Artisan::call('notifications:vapid');
    $first = Artisan::output();

    Artisan::call('notifications:vapid');
    $second = Artisan::output();

    expect($first)->not->toBe($second);
});
