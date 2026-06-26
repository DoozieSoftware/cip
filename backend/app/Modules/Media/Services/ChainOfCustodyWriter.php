<?php

declare(strict_types=1);

namespace App\Modules\Media\Services;

use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaAccessLog;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * ChainOfCustodyWriter — append-only audit logger for the M5
 * media pipeline.
 *
 * Per docs/11 §15 every read or write that touches a Media
 * row must leave a row in `media_access_logs` so the chain
 * of custody is reconstructable at any time:
 *
 *   - capture_time   (from Media.captured_at)
 *   - upload_time    (from Media.uploaded_at)
 *   - uploader       (from Media.uploaded_by)
 *   - device         (from Media.metadata.device or the
 *                     requesting UA on read events)
 *   - hash           (from Media.checksum)
 *   - storage_path   (from Media.storage_path)
 *
 * On the read path (T-M5-014 list endpoint, the signed
 * serve endpoint) the writer is called from the controller
 * via the helper method `recordFromRequest(...)` which
 * captures the IP, user agent, and authenticated actor
 * automatically.
 */
class ChainOfCustodyWriter
{
    public const EVENT_VIEW = 'VIEW';

    public const EVENT_DOWNLOAD = 'DOWNLOAD';

    public const EVENT_REPLACE = 'REPLACE';

    public const EVENT_DELETE = 'DELETE';

    public const EVENT_VIRUS_SCAN = 'VIRUS_SCAN';

    /**
     * @param  array<string, mixed>  $metadata
     */
    public function record(
        Media $media,
        string $event,
        ?User $actor = null,
        ?string $ip = null,
        ?string $userAgent = null,
        array $metadata = [],
    ): MediaAccessLog {
        $defaultMeta = [
            'capture_time' => optional($media->captured_at)->toIso8601String(),
            'upload_time' => optional($media->uploaded_at)->toIso8601String(),
            'uploader' => $media->uploaded_by,
            'hash' => $media->checksum,
            'storage_path' => $media->storage_path,
            'storage_disk' => $media->storage_disk,
            'version' => $media->version,
        ];

        $row = MediaAccessLog::query()->create([
            'media_id' => $media->id,
            'actor_id' => $actor?->id,
            'event' => $event,
            'ip' => $ip,
            'user_agent' => $userAgent,
            'metadata' => array_merge($defaultMeta, $metadata),
            'created_at' => Carbon::now(),
        ]);

        return $row;
    }

    /**
     * Convenience: record a chain-of-custody event from a
     * live HTTP request (capturing IP + UA from the request).
     *
     * @param  array<string, mixed>  $metadata
     */
    public function recordFromRequest(
        Media $media,
        string $event,
        Request $request,
        array $metadata = [],
    ): MediaAccessLog {
        $actor = null;
        $user = $request->user('sanctum');

        if ($user instanceof User) {
            $actor = $user;
        }

        return $this->record(
            $media,
            $event,
            $actor,
            (string) $request->ip(),
            (string) $request->userAgent(),
            $metadata,
        );
    }

    /**
     * Audit query: every chain-of-custody row for a Media row,
     * newest first. The MediaController's audit endpoint
     * (T-M5-016) is gated to staff.
     *
     * @return Collection<int, MediaAccessLog>
     */
    public function historyFor(string $mediaId, int $limit = 100)
    {
        if (! Media::query()->whereKey($mediaId)->exists()) {
            throw (new ModelNotFoundException)->setModel(Media::class, [$mediaId]);
        }

        return MediaAccessLog::query()
            ->where('media_id', $mediaId)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();
    }
}
