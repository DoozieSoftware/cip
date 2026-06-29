<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Settings\Models\Setting;
use Illuminate\Support\Facades\Storage;

/**
 * T-M12-008 — Super Admin write-side for media storage.
 *
 * Owns:
 *  - the canonical `media_storage` settings row
 *  - the `cip.media.disk` runtime config flip
 *  - a reachability probe for the configured disk
 *
 * The actual S3 / MinIO access keys live in env
 * (`AWS_*`); the settings row stores the bucket,
 * region, endpoint, and the disk selection, not the
 * credentials.
 */
class MediaStorageService
{
    public const SETTINGS_KEY = 'media_storage';

    /**
     * @return array{disk:string, region:?string, bucket:?string, endpoint:?string, retention_days:int, encryption_at_rest:bool, max_photo_bytes:int, max_video_bytes:int, max_document_bytes:int}
     */
    public function defaults(): array
    {
        return [
            'disk' => (function (): string {
                $cfg = (string) config('cip.media.disk', 'local');
                if ($cfg === 'local') {
                    return 'media_local';
                }
                if (in_array($cfg, ['media_local', 'media_minio', 'media_s3'], true)) {
                    return $cfg;
                }
                return 'media_local';
            })(),
            'region' => null,
            'bucket' => null,
            'endpoint' => null,
            'retention_days' => 0,
            'encryption_at_rest' => false,
            'max_photo_bytes' => 16 * 1024 * 1024,
            'max_video_bytes' => 100 * 1024 * 1024,
            'max_document_bytes' => 25 * 1024 * 1024,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function current(): array
    {
        $row = Setting::query()->where('key', self::SETTINGS_KEY)->first();
        if ($row === null) {
            return $this->defaults();
        }
        /** @var array<string, mixed> $value */
        $value = is_array($row->value) ? $row->value : [];
        $defaults = $this->defaults();

        return array_replace($defaults, $value);
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    public function update(array $attributes): array
    {
        $current = $this->current();
        $next = array_replace($current, array_intersect_key($attributes, array_flip([
            'disk', 'region', 'bucket', 'endpoint',
            'retention_days', 'encryption_at_rest',
            'max_photo_bytes', 'max_video_bytes', 'max_document_bytes',
        ])));

        // Persist to settings
        Setting::set(self::SETTINGS_KEY, $next, 'array');

        // Flip the runtime config so the next upload uses
        // the new disk. This survives the request boundary
        // because the next call to `config('cip.media.disk')`
        // re-reads env unless a settings row is present —
        // but the MediaService (T-M5) checks the row first
        // so the new disk is honoured on the very next call.
        config(['cip.media.disk' => $next['disk']]);

        return $next;
    }

    /**
     * @return array{disk:string, reachable:bool, message:string}
     */
    public function probe(): array
    {
        $current = $this->current();
        $disk = (string) $current['disk'];

        try {
            $exists = Storage::disk($disk)->exists('.cip-probe');
            if (! $exists) {
                Storage::disk($disk)->put('.cip-probe', (string) now());
                Storage::disk($disk)->delete('.cip-probe');
            }

            return [
                'disk' => $disk,
                'reachable' => true,
                'message' => 'Disk probe succeeded.',
            ];
        } catch (\Throwable $e) {
            return [
                'disk' => $disk,
                'reachable' => false,
                'message' => $e->getMessage(),
            ];
        }
    }
}
