<?php

declare(strict_types=1);

use App\Modules\Media\Jobs\ComputeHashesJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaHash;
use App\Modules\Media\Services\HashService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);


const CHJ_TINY_JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z';

it('uses tries=3 with 30s backoff (docs/14 §16 retry policy)', function (): void {
    $job = new ComputeHashesJob('00000000-0000-7000-8000-000000000001');
    expect($job->tries)->toBe(3)->and($job->backoff)->toBe(30);
});

it('implements ShouldQueue', function (): void {
    $job = new ComputeHashesJob('00000000-0000-7000-8000-000000000001');
    expect($job)->toBeInstanceOf(ShouldQueue::class);
});

it('handle() populates all four hash fields (sha256, sha512, perceptual_hash, video_fingerprint) — acceptance', function (): void {
    Storage::fake('local');
    $media = Media::factory()->create([
        'storage_disk' => 'local',
        'storage_path' => 'reports/abc/photo.jpg',
        'mime' => 'image/jpeg',
        'checksum' => 'placeholder',
    ]);
    Storage::disk('local')->put($media->storage_path, base64_decode(CHJ_TINY_JPEG));

    (new ComputeHashesJob($media->id))->handle(app(HashService::class));

    $hash = MediaHash::query()->where('media_id', $media->id)->firstOrFail();

    expect($hash->sha256)->toBeString()->toHaveLength(64)
        ->and($hash->sha512)->toBeString()->toHaveLength(128)
        ->and($hash->perceptual_hash)->toBeString()->toHaveLength(16)
        ->and($hash->video_fingerprint)->toBeNull();

    $media->refresh();
    expect($media->checksum)->toBe($hash->sha256);
});

it('handle() is a no-op when the media row has been deleted between dispatch and execution', function (): void {
    Log::spy();

    (new ComputeHashesJob('00000000-0000-7000-8000-deadbeef0000'))
        ->handle(app(HashService::class));

    Illuminate\Support\Facades\Log::shouldHaveReceived('info')
        ->withArgs(fn (string $msg, array $ctx): bool => $msg === 'media.hashes.skipped_missing_media')
        ->once();
});

it('handle() throws and logs when the source asset is missing on disk', function (): void {
    Storage::fake('local');
    Log::spy();

    $media = Media::factory()->create([
        'storage_disk' => 'local',
        'storage_path' => 'reports/zz/missing.jpg',
        'mime' => 'image/jpeg',
    ]);
    // No put() — the file is missing.

    $job = new ComputeHashesJob($media->id);
    expect(fn () => $job->handle(app(HashService::class)))
        ->toThrow(RuntimeException::class);

    Illuminate\Support\Facades\Log::shouldHaveReceived('warning')
        ->withArgs(fn (string $msg, array $ctx): bool => $msg === 'media.hashes.failed'
            && ($ctx['media_id'] ?? null) === $media->id)
        ->once();
});

it('tags itself for queue metrics so the ops dashboard can filter', function (): void {
    $job = new ComputeHashesJob('00000000-0000-7000-8000-0000000000ff');
    expect($job->tags())->toBe(['media', 'media.hashes', 'media:00000000-0000-7000-8000-0000000000ff']);
});
