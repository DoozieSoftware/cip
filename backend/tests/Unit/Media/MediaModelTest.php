<?php

declare(strict_types=1);

use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaHash;
use App\Modules\Reports\Models\Report;
use App\Modules\Users\Models\User;
use Illuminate\Database\QueryException;

it('uses a UUID primary key and the media table', function (): void {
    $media = new Media;
    expect($media->getTable())->toBe('media')
        ->and($media->getKeyName())->toBe('id')
        ->and($media->getKeyType())->toBe('string');
});

it('casts metadata to array, size/width/height/duration/version to integer, is_replaced to bool, captured_at/uploaded_at to datetime', function (): void {
    $media = new Media;
    $casts = $media->getCasts();

    expect($casts)->toHaveKey('metadata')
        ->and($casts['metadata'])->toBe('array')
        ->and($casts)->toHaveKey('size')
        ->and($casts['size'])->toBe('integer')
        ->and($casts)->toHaveKey('width')
        ->and($casts['width'])->toBe('integer')
        ->and($casts)->toHaveKey('height')
        ->and($casts['height'])->toBe('integer')
        ->and($casts)->toHaveKey('duration')
        ->and($casts['duration'])->toBe('integer')
        ->and($casts)->toHaveKey('version')
        ->and($casts['version'])->toBe('integer')
        ->and($casts)->toHaveKey('is_replaced')
        ->and($casts['is_replaced'])->toBe('boolean')
        ->and($casts)->toHaveKey('captured_at')
        ->and($casts['captured_at'])->toBe('datetime')
        ->and($casts)->toHaveKey('uploaded_at')
        ->and($casts['uploaded_at'])->toBe('datetime');
});

it('persists via the factory and roundtrips the metadata JSON cast', function (): void {
    $media = Media::factory()->create([
        'metadata' => ['source' => 'unit', 'exif' => ['make' => 'TestCo']],
    ]);

    $media->refresh();
    expect($media->metadata)->toBe(['source' => 'unit', 'exif' => ['make' => 'TestCo']])
        ->and($media->version)->toBe(1)
        ->and($media->is_replaced)->toBeFalse();
});

it('exposes a report belongsTo relation that resolves to a Report', function (): void {
    $report = Report::factory()->create();
    $media = Media::factory()->create(['report_id' => $report->id]);

    expect($media->report)->toBeInstanceOf(Report::class)
        ->and($media->report->id)->toBe($report->id)
        ->and($media->report()->getForeignKeyName())->toBe('report_id');
});

it('exposes an uploader belongsTo relation that resolves to a User', function (): void {
    $user = User::factory()->create();
    $media = Media::factory()->create(['uploaded_by' => $user->id]);

    expect($media->uploader)->toBeInstanceOf(User::class)
        ->and($media->uploader->id)->toBe($user->id)
        ->and($media->uploader()->getForeignKeyName())->toBe('uploaded_by');
});

it('exposes a hashes HasMany relation that returns all the MediaHash rows for the asset', function (): void {
    $media = Media::factory()->create();
    MediaHash::factory()->count(2)->create(['media_id' => $media->id]);
    // noise row that must not appear in the relation
    $other = Media::factory()->create();
    MediaHash::factory()->create(['media_id' => $other->id]);

    expect($media->hashes)->toHaveCount(2)
        ->and($media->hashes->pluck('media_id')->unique()->all())->toBe([$media->id])
        ->and($media->hashes()->getForeignKeyName())->toBe('media_id');
});

it('enforces the unique (media_id, sha256) pair at the database level', function (): void {
    $media = Media::factory()->create();
    $sha = 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd';

    MediaHash::factory()->create(['media_id' => $media->id, 'sha256' => $sha]);

    expect(fn () => MediaHash::factory()->create(['media_id' => $media->id, 'sha256' => $sha]))
        ->toThrow(QueryException::class);
});
