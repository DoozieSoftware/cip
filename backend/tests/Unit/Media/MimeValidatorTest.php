<?php

declare(strict_types=1);

use App\Modules\Media\Exceptions\InvalidMediaException;
use App\Modules\Media\Services\MimeValidator;
use Illuminate\Http\UploadedFile;

/**
 * Real-world test fixtures:
 *  - TINY_JPEG  : 1x1 white pixel JPEG (finfo sniffs as image/jpeg)
 *  - TINY_PNG   : 1x1 white pixel PNG  (finfo sniffs as image/png)
 *  - TINY_PDF   : minimal valid PDF      (finfo sniffs as application/pdf)
 *  - TINY_MP4   : 64-byte ISO-BMFF ftyp box at offset 4
 */
const TINY_JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z';
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const TINY_PDF = 'JVBERi0xLjQKJeLjz9MKMSAwIG9iaiA8PC9MZW5ndGggNzIvRmlsdGVyL0ZsYXRlRGVjb2RlPj5zdHJlYW0KeJzj5OXMz1XMr1QoKM3MTwEAJZwB/ApBFPkKZW5kc3RyZWFtCmVuZG9iago=';
const TINY_MP4 = 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAW1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAUAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function buildUploadedFixture(string $base64, string $ext, string $clientMime): UploadedFile
{
    $tmp = tempnam(sys_get_temp_dir(), 'cip-mv-');
    $new = $tmp.'.'.$ext;
    rename($tmp, $new);
    file_put_contents($new, base64_decode($base64));

    return new UploadedFile($new, 'fixture.'.$ext, $clientMime, null, true);
}

beforeEach(function (): void {
    $this->validator = new MimeValidator;
});

it('accepts a real JPEG under the PHOTO bucket', function (): void {
    $file = buildUploadedFixture(TINY_JPEG, 'jpg', 'image/jpeg');
    $this->validator->validate($file, 'PHOTO');
    expect(true)->toBeTrue();
});

it('accepts a real PNG under the PHOTO bucket', function (): void {
    $file = buildUploadedFixture(TINY_PNG, 'png', 'image/png');
    $this->validator->validate($file, 'PHOTO');
    expect(true)->toBeTrue();
});

it('rejects a .php that is renamed to .jpg because the magic bytes do not match', function (): void {
    $tmp = tempnam(sys_get_temp_dir(), 'cip-mv-');
    $new = $tmp.'.jpg';
    rename($tmp, $new);
    file_put_contents($new, "<?php echo 'pwn';\n/*".str_repeat(' ', 16));
    $file = new UploadedFile($new, 'shell.jpg', 'image/jpeg', null, true);

    expect(fn () => $this->validator->validate($file, 'PHOTO'))
        ->toThrow(InvalidMediaException::class);
});

it('throws MEDIA_INVALID_MIME on a server-detected mime that is not in the allowed set for the bucket', function (): void {
    // Real PDF bytes, but we ask for PHOTO
    $file = buildUploadedFixture(TINY_PDF, 'pdf', 'application/pdf');

    try {
        $this->validator->validate($file, 'PHOTO');
        test()->fail('expected InvalidMediaException');
    } catch (InvalidMediaException $e) {
        expect($e->errorCode)->toBe('MEDIA_INVALID_MIME')
            ->and($e->httpStatus)->toBe(422);
    }
});

it('throws MEDIA_INVALID_MIME when the client-claimed mime disagrees with the server-detected mime', function (): void {
    // Valid JPEG bytes but the client claims it is image/png.
    $file = buildUploadedFixture(TINY_JPEG, 'jpg', 'image/png');

    try {
        $this->validator->validate($file, 'PHOTO');
        test()->fail('expected InvalidMediaException');
    } catch (InvalidMediaException $e) {
        expect($e->errorCode)->toBe('MEDIA_INVALID_MIME');
    }
});

it('accepts a real PDF under the DOCUMENT bucket', function (): void {
    $file = buildUploadedFixture(TINY_PDF, 'pdf', 'application/pdf');
    $this->validator->validate($file, 'DOCUMENT');
    expect(true)->toBeTrue();
});

it('accepts a real MP4 under the VIDEO bucket (ftyp at offset 4)', function (): void {
    $file = buildUploadedFixture(TINY_MP4, 'mp4', 'video/mp4');
    $this->validator->validate($file, 'VIDEO');
    expect(true)->toBeTrue();
});

it('rejects an unknown bucket name', function (): void {
    $file = buildUploadedFixture(TINY_JPEG, 'jpg', 'image/jpeg');

    try {
        $this->validator->validate($file, 'AUDIO');
        test()->fail('expected InvalidMediaException');
    } catch (InvalidMediaException $e) {
        expect($e->errorCode)->toBe('MEDIA_INVALID_MIME')
            ->and($e->details['expected'])->toBe('AUDIO');
    }
});
