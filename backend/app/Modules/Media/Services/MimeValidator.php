<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Media\Exceptions\InvalidMediaException;
use Illuminate\Http\UploadedFile;
use Throwable;

/**
 * Defence-in-depth validation for uploaded evidence files.
 *
 * Per docs/11 §32 (File Security) every upload must clear three
 * gates before it can be persisted:
 *
 *  1. Reported mime (`$file->getMimeType()` — server-side via
 *     finfo) must match one of the allowed types for the
 *     expected bucket.
 *  2. Client-claimed mime (`$file->getClientMimeType()` — taken
 *     from the multipart envelope) must agree with the
 *     server-detected mime. A mismatch usually means the client
 *     lied about the file type.
 *  3. Magic-byte signature sniff (`finfo_buffer` over the first
 *     N bytes) must confirm the file is actually a member of the
 *     expected type. A `.jpg` whose bytes start with `<?php` is
 *     rejected.
 *
 * The service is invoked by MediaService::upload (T-M5-011) and
 * by the multipart endpoints (T-M5-012 / T-M5-013) before any
 * storage write happens. It is side-effect free.
 */
class MimeValidator
{
    /**
     * The M5 type buckets. Each bucket is a short identifier the
     * controller passes; the service maps it to the set of
     * mimes, extensions, and magic-byte signatures that are
     * allowed for that bucket.
     *
     * @var array<string, array{
     *     mimes: list<string>,
     *     extensions: list<string>,
     *     signatures: list<array{bytes: list<int>, offset: int}>
     * }>
     */
    private const ALLOWED = [
        'PHOTO' => [
            'mimes' => ['image/jpeg', 'image/png'],
            'extensions' => ['jpg', 'jpeg', 'png'],
            'signatures' => [
                // JPEG: FF D8 FF
                ['bytes' => [0xFF, 0xD8, 0xFF], 'offset' => 0],
                // PNG: 89 50 4E 47 0D 0A 1A 0A
                ['bytes' => [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 'offset' => 0],
            ],
        ],
        'VIDEO' => [
            'mimes' => ['video/mp4', 'video/quicktime'],
            'extensions' => ['mp4', 'mov', 'm4v'],
            'signatures' => [
                // MP4 / Quicktime / ISO-BMFF: starts with ....ftyp (offset 4)
                ['bytes' => [0x66, 0x74, 0x79, 0x70], 'offset' => 4],
            ],
        ],
        'DOCUMENT' => [
            'mimes' => ['application/pdf'],
            'extensions' => ['pdf'],
            'signatures' => [
                // PDF: 25 50 44 46 ("%PDF")
                ['bytes' => [0x25, 0x50, 0x44, 0x46], 'offset' => 0],
            ],
        ],
    ];

    /**
     * @param  string  $expectedType  one of PHOTO, VIDEO, DOCUMENT
     *
     * @throws InvalidMediaException when the upload fails any of the three gates
     */
    public function validate(UploadedFile $file, string $expectedType): void
    {
        if (! isset(self::ALLOWED[$expectedType])) {
            throw new InvalidMediaException(
                'MEDIA_INVALID_MIME',
                "Unknown media bucket '{$expectedType}'.",
                422,
                ['expected' => $expectedType],
            );
        }

        $config = self::ALLOWED[$expectedType];

        $serverMime = (string) $file->getMimeType();
        $clientMime = (string) $file->getClientMimeType();

        // Gate 1: server-detected mime must be in the allowed list.
        if (! in_array($serverMime, $config['mimes'], true)) {
            throw InvalidMediaException::invalidMime($serverMime, implode('|', $config['mimes']));
        }

        // Gate 2: client-claimed mime must agree with the server-detected mime.
        if ($clientMime !== '' && $clientMime !== $serverMime) {
            throw InvalidMediaException::invalidMime($clientMime, $serverMime);
        }

        // Gate 3: magic-byte signature sniff. We do this last
        // because it requires reading the file. The first 16
        // bytes are sufficient to cover the signatures above.
        $path = $file->getRealPath();

        if ($path === false) {
            throw InvalidMediaException::invalidSignature(implode('|', $config['mimes']));
        }

        $handle = @fopen($path, 'rb');

        if ($handle === false) {
            throw InvalidMediaException::invalidSignature(implode('|', $config['mimes']));
        }

        try {
            $head = fread($handle, 16);
        } catch (Throwable $e) {
            fclose($handle);

            throw InvalidMediaException::invalidSignature(implode('|', $config['mimes']), $e);
        }
        fclose($handle);

        if ($head === false || $head === '') {
            throw InvalidMediaException::invalidSignature(implode('|', $config['mimes']));
        }

        $bytes = array_values(unpack('C*', $head));

        if (! $this->matchesAnySignature($bytes, $config['signatures'])) {
            throw InvalidMediaException::invalidSignature(implode('|', $config['mimes']));
        }
    }

    /**
     * @param  list<int>  $bytes
     * @param  list<array{bytes: list<int>, offset: int}>  $signatures
     */
    private function matchesAnySignature(array $bytes, array $signatures): bool
    {
        foreach ($signatures as $sig) {
            $offset = $sig['offset'];
            $needle = $sig['bytes'];

            if (count($bytes) < $offset + count($needle)) {
                continue;
            }

            $ok = true;

            foreach ($needle as $i => $byte) {
                if ($bytes[$offset + $i] !== $byte) {
                    $ok = false;
                    break;
                }
            }

            if ($ok) {
                return true;
            }
        }

        return false;
    }
}
