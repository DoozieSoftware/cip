<?php

declare(strict_types=1);

use App\Modules\Media\Http\Resources\MediaResource;
use App\Modules\Media\Models\Media;
use Illuminate\Support\Carbon;
use Tests\TestCase;

uses(TestCase::class);

/**
 * MediaResource is the stable wire format shared by the citizen
 * PWA and the moderator portal (docs/05 §14). These tests pin
 * the serialized shape without touching the database: the model
 * is hydrated in memory so the resource logic is exercised in
 * isolation.
 *
 * @param  array<string, mixed>  $overrides
 */
function makeMedia(array $overrides = []): Media
{
    $media = new Media;
    /** @var array<string, mixed> $attributes */
    $attributes = array_merge([
        'id' => '019f0da4-0000-7000-8000-000000000abc',
        'report_id' => '019f0da4-0000-7000-8000-000000000def',
        'type' => 'photo',
        'mime' => 'image/jpeg',
        'size' => '204800',
        'width' => 1024,
        'height' => 768,
        'duration' => null,
        'checksum' => 'sha256:deadbeef',
        'storage_disk' => 'local',
        'storage_path' => 'reports/abc/photo-1.jpg',
        'captured_at' => Carbon::parse('2026-07-01T10:00:00+00:00'),
        'uploaded_at' => Carbon::parse('2026-07-01T10:05:00+00:00'),
        'uploaded_by' => '019f0da4-0000-7000-8000-000000000111',
        'version' => '2',
        'is_replaced' => 0,
        'metadata' => ['scanner' => 'none'],
    ], $overrides);

    $media->forceFill($attributes);

    return $media;
}

it('serializes the full media wire shape with correct types', function (): void {
    $array = (new MediaResource(makeMedia()))->toArray(request());

    expect($array)->toMatchArray([
        'id' => '019f0da4-0000-7000-8000-000000000abc',
        'report_id' => '019f0da4-0000-7000-8000-000000000def',
        'type' => 'photo',
        'mime' => 'image/jpeg',
        'width' => 1024,
        'height' => 768,
        'checksum' => 'sha256:deadbeef',
        'storage_disk' => 'local',
        'storage_path' => 'reports/abc/photo-1.jpg',
        'uploaded_by' => '019f0da4-0000-7000-8000-000000000111',
    ])
        ->and($array['size'])->toBe(204800)
        ->and($array['version'])->toBe(2)
        ->and($array['is_replaced'])->toBeFalse()
        ->and($array['metadata'])->toBe(['scanner' => 'none']);
});

it('emits ISO-8601 timestamps for captured_at and uploaded_at', function (): void {
    $array = (new MediaResource(makeMedia()))->toArray(request());

    expect($array['captured_at'])->toBe('2026-07-01T10:00:00+00:00')
        ->and($array['uploaded_at'])->toBe('2026-07-01T10:05:00+00:00');
});

it('leaves captured_at null when the media has no capture timestamp', function (): void {
    $array = (new MediaResource(makeMedia(['captured_at' => null])))->toArray(request());

    expect($array['captured_at'])->toBeNull();
});

it('defaults metadata to an empty array when the column is null', function (): void {
    $array = (new MediaResource(makeMedia(['metadata' => null])))->toArray(request());

    expect($array['metadata'])->toBe([]);
});

it('coerces size, version and is_replaced from raw storage values', function (): void {
    $array = (new MediaResource(makeMedia([
        'size' => '0',
        'version' => '1',
        'is_replaced' => 1,
    ])))->toArray(request());

    expect($array['size'])->toBe(0)
        ->and($array['version'])->toBe(1)
        ->and($array['is_replaced'])->toBeTrue();
});
