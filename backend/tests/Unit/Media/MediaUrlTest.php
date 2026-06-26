<?php

declare(strict_types=1);

use App\Modules\Media\Models\Media;
use App\Modules\Media\Support\MediaUrl;
use Illuminate\Support\Facades\URL;

it('returns a temporary signed route URL when the disk has no temporaryUrl() — falls back to Laravel signed route (acceptance: URL is verifiable by Laravel signed-route middleware)', function (): void {
    $media = Media::factory()->create([
        'storage_disk' => 'local',
        'storage_path' => 'evidence/abc/photo.jpg',
    ]);

    $url = (new MediaUrl)->temporary($media, 15);

    expect($url)->toBeString()->toContain('/api/v1/media/'.$media->id.'/serve')
        ->and($url)->toContain('signature=')
        ->and($url)->toContain('expires=');

    // Verifiable by Laravel's signed middleware: a request to
    // the URL inside the TTL must NOT 403.
    // The signed-route middleware must NOT reject; it only
    // rejects (403) on missing/tampered signature. The 410
    // here is from the bytes-missing gate, which proves the
    // signed middleware let the request through.
    $this->get($url)->assertStatus(410);
});

it('respects the requested TTL', function (): void {
    $media = Media::factory()->create(['storage_disk' => 'local', 'storage_path' => 'x/y.jpg']);

    $url = (new MediaUrl)->temporary($media, 7);

    $expires = (int) (parse_url($url, PHP_URL_QUERY) ? null : 0);
    $qs = parse_url($url, PHP_URL_QUERY);
    parse_str((string) $qs, $params);

    $expected = now()->addMinutes(7)->timestamp;
    expect(abs(((int) $params['expires']) - $expected))->toBeLessThanOrEqual(2);
});

it('uses the default TTL of 15 minutes when none is given', function (): void {
    $media = Media::factory()->create(['storage_disk' => 'local', 'storage_path' => 'x/y.jpg']);

    $url = (new MediaUrl)->temporary($media);
    $qs = parse_url($url, PHP_URL_QUERY);
    parse_str((string) $qs, $params);

    $expected = now()->addMinutes(15)->timestamp;
    expect(abs(((int) $params['expires']) - $expected))->toBeLessThanOrEqual(2);
});

it('an expired URL produced by the helper is rejected by the signed-route middleware (acceptance: verifiable by signed-route middleware)', function (): void {
    $media = Media::factory()->create(['storage_disk' => 'local', 'storage_path' => 'x/y.jpg']);

    // Generate a URL with a TTL in the past by hand-rolling
    // the signed URL the same way the helper does, but with
    // a negative offset.
    $url = URL::temporarySignedRoute(
        'api.v1.media.serve',
        now()->subMinute(),
        ['media' => $media->id],
    );

    $this->get($url)->assertStatus(403);
});
