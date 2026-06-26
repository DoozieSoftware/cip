<?php

declare(strict_types=1);

use App\Modules\Media\Exceptions\InvalidMediaException;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Services\ThumbnailService;
use Illuminate\Support\Facades\Storage;

const THS_TINY_JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z';

beforeEach(function (): void {
    Storage::fake('local');
    $this->service = new ThumbnailService;
});

function thsPutFixture(string $disk, Media $media, string $base64): void
{
    Storage::disk($disk)->put($media->storage_path, base64_decode($base64));
}

it('generates a 320px-wide thumbnail into the same disk and returns its path (acceptance)', function (): void {
    $media = Media::factory()->create([
        'type' => 'PHOTO',
        'storage_disk' => 'local',
        'storage_path' => 'reports/abc/def.jpg',
        'mime' => 'image/jpeg',
    ]);
    thsPutFixture('local', $media, THS_TINY_JPEG);

    $path = $this->service->generate($media);

    expect($path)->toBe('reports/abc/'.$media->id.'/thumb.jpg')
        ->and(Storage::disk('local')->exists($path))->toBeTrue();
});

it('produces an output JPEG of ≤ 50 KB on the real 285-byte 1x1 fixture', function (): void {
    $media = Media::factory()->create([
        'type' => 'PHOTO',
        'storage_disk' => 'local',
        'storage_path' => 'reports/x/y.jpg',
        'mime' => 'image/jpeg',
    ]);
    thsPutFixture('local', $media, THS_TINY_JPEG);

    $path = $this->service->generate($media);
    $bytes = Storage::disk('local')->get($path);
    $size = strlen($bytes);

    expect($size)->toBeLessThanOrEqual(50 * 1024)
        ->and(substr($bytes, 0, 3))->toBe("\xFF\xD8\xFF");
});

it('throws MEDIA_INVALID_MIME on a non-image asset', function (): void {
    $media = Media::factory()->create([
        'type' => 'VIDEO',
        'storage_disk' => 'local',
        'storage_path' => 'reports/v/clip.mp4',
        'mime' => 'video/mp4',
    ]);

    expect(fn () => $this->service->generate($media))
        ->toThrow(InvalidMediaException::class);
});

it('throws when the source asset is missing on disk', function (): void {
    $media = Media::factory()->create([
        'type' => 'PHOTO',
        'storage_disk' => 'local',
        'storage_path' => 'reports/zz/missing.jpg',
        'mime' => 'image/jpeg',
    ]);

    expect(fn () => $this->service->generate($media))
        ->toThrow(RuntimeException::class);
});

it('produces a thumbnail with a width of exactly 320px', function (): void {
    // A bigger source so the resize is meaningful. Build a
    // 200x200 red JPEG via GD inline.
    $src = imagecreatetruecolor(200, 200);
    imagefill($src, 0, 0, imagecolorallocate($src, 255, 0, 0));
    ob_start();
    imagejpeg($src, null, 90);
    $jpeg = ob_get_clean();
    imagedestroy($src);

    $media = Media::factory()->create([
        'type' => 'PHOTO',
        'storage_disk' => 'local',
        'storage_path' => 'reports/big/red.jpg',
        'mime' => 'image/jpeg',
    ]);
    Storage::disk('local')->put($media->storage_path, $jpeg);

    $path = $this->service->generate($media);
    $bytes = Storage::disk('local')->get($path);

    $tmp = tempnam(sys_get_temp_dir(), 'cip-th-').'.jpg';
    file_put_contents($tmp, $bytes);
    $gd = imagecreatefromjpeg($tmp);
    $w = imagesx($gd);
    $h = imagesy($gd);
    imagedestroy($gd);

    expect($w)->toBe(320)
        ->and($h)->toBe(320); // 200x200 square => square thumb
});
