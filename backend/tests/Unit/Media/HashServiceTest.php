<?php

declare(strict_types=1);

use App\Modules\Media\Services\HashService;
use Illuminate\Http\UploadedFile;

const HS_TINY_JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z';
const HS_TINY_MP4 = 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAW1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAUAAEAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function hsBuildFile(string $base64, string $ext, string $mime): UploadedFile
{
    $tmp = tempnam(sys_get_temp_dir(), 'cip-hs-');
    $new = $tmp.'.'.$ext;
    rename($tmp, $new);
    file_put_contents($new, base64_decode($base64));

    return new UploadedFile($new, 'fixture.'.$ext, $mime, null, true);
}

beforeEach(function (): void {
    $this->service = new HashService;
});

it('returns the expected shape with sha256, sha512, perceptual_hash, and video_fingerprint', function (): void {
    $file = hsBuildFile(HS_TINY_JPEG, 'jpg', 'image/jpeg');
    $result = $this->service->compute($file);

    expect($result)->toHaveKeys(['sha256', 'sha512', 'perceptual_hash', 'video_fingerprint'])
        ->and($result['sha256'])->toBeString()->toHaveLength(64)
        ->and($result['sha512'])->toBeString()->toHaveLength(128)
        ->and($result['perceptual_hash'])->toBeString()->toHaveLength(16)
        ->and($result['video_fingerprint'])->toBeNull();
});

it('is deterministic — the same file produces identical hashes (acceptance)', function (): void {
    $path = tempnam(sys_get_temp_dir(), 'cip-hs-').'.jpg';
    file_put_contents($path, base64_decode(HS_TINY_JPEG));

    $a = new UploadedFile($path, 'a.jpg', 'image/jpeg', null, true);
    $b = new UploadedFile($path, 'b.jpg', 'image/jpeg', null, true);

    $ra = $this->service->compute($a);
    $rb = $this->service->compute($b);

    expect($ra['sha256'])->toBe($rb['sha256'])
        ->and($ra['sha512'])->toBe($rb['sha512'])
        ->and($ra['perceptual_hash'])->toBe($rb['perceptual_hash']);
});

it('computes a video_fingerprint for video assets and leaves it null for images', function (): void {
    $image = hsBuildFile(HS_TINY_JPEG, 'jpg', 'image/jpeg');
    $video = hsBuildFile(HS_TINY_MP4, 'mp4', 'video/mp4');

    $ir = $this->service->compute($image);
    $vr = $this->service->compute($video);

    expect($ir['video_fingerprint'])->toBeNull()
        ->and($vr['video_fingerprint'])->toBeString()->toHaveLength(40);
});

it('returns 16 zero chars as the perceptual hash for non-image assets', function (): void {
    // application/pdf is not a mime GD decodes; we expect a
    // safe zero-string fallback.
    $tmp = tempnam(sys_get_temp_dir(), 'cip-hs-').'.pdf';
    file_put_contents($tmp, '%PDF-1.4'.str_repeat(' ', 32));
    $file = new UploadedFile($tmp, 'doc.pdf', 'application/pdf', null, true);

    $r = $this->service->compute($file);

    expect($r['perceptual_hash'])->toBe(str_repeat('0', 16));
});

it('produces a sha256 of the canonical hex of the file contents', function (): void {
    $tmp = tempnam(sys_get_temp_dir(), 'cip-hs-').'.jpg';
    file_put_contents($tmp, base64_decode(HS_TINY_JPEG));
    $file = new UploadedFile($tmp, 'a.jpg', 'image/jpeg', null, true);

    $r = $this->service->compute($file);
    $expected = hash_file('sha256', $tmp);

    expect($r['sha256'])->toBe($expected);
});
