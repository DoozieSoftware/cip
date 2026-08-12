<?php

declare(strict_types=1);

namespace App\Modules\Reports\Services;

use App\Modules\Media\Models\Media;
use App\Modules\Reports\Models\Report;
use Illuminate\Support\Facades\Storage;

/**
 * Builds the server-authoritative evidence manifest used by draft upload and
 * finalization. Only current citizen evidence is eligible; officer proof and
 * replaced assets never satisfy citizen submission requirements.
 */
final class EvidenceManifestService
{
    /**
     * @return array<string, mixed>
     */
    public function manifest(Report $report): array
    {
        $type = $report->relationLoaded('reportType') ? $report->reportType : $report->reportType()->first();
        $media = Media::query()
            ->where('report_id', $report->id)
            ->where('role', 'evidence')
            ->where('is_replaced', false)
            ->with('hashes')
            ->orderBy('uploaded_at')
            ->get();

        $photos = $media->where('type', 'PHOTO')->values();
        $videos = $media->where('type', 'VIDEO')->values();
        $documents = $media->where('type', 'DOCUMENT')->values();
        $minPhotos = max(0, $type === null ? 0 : (int) $type->min_photos);
        $requiresPhoto = $type !== null && (bool) $type->requires_photo;
        $requiresVideo = $type !== null && (bool) $type->requires_video;
        $requiredPhotoCount = $requiresPhoto ? max(1, $minPhotos) : $minPhotos;

        $assets = $media->map(function (Media $asset): array {
            $storageReady = false;

            try {
                $storageReady = Storage::disk($asset->storage_disk ?: 'local')->exists($asset->storage_path);
            } catch (\Throwable) {
                $storageReady = false;
            }

            $hash = $asset->hashes->sortByDesc('created_at')->first();
            $hashReady = $hash !== null
                && is_string($hash->sha256)
                && preg_match('/^[a-f0-9]{64}$/i', $hash->sha256) === 1
                && is_string($asset->checksum)
                && preg_match('/^[a-f0-9]{64}$/i', $asset->checksum) === 1;

            return [
                'id' => $asset->id,
                'type' => $asset->type,
                'role' => $asset->role ?? 'evidence',
                'size' => (int) $asset->size,
                'uploaded_at' => $asset->uploaded_at->toIso8601String(),
                'storage_ready' => $storageReady,
                'hash_ready' => $hashReady,
                'sha256' => $hash?->sha256,
                'status' => $storageReady && $hashReady ? 'ready' : ($storageReady ? 'hash_pending' : 'upload_pending'),
            ];
        })->all();

        $errors = [];

        if ($requiredPhotoCount > $photos->count()) {
            $errors['photos'] = "At least {$requiredPhotoCount} photo(s) are required.";
        }

        if ($requiresVideo && $videos->isEmpty()) {
            $errors['video'] = 'A video is required for this report type.';
        }

        foreach ($assets as $asset) {
            if ($asset['status'] !== 'ready') {
                $errors['assets.'.$asset['id']] = $asset['status'] === 'hash_pending'
                    ? 'Evidence hash is still being computed.'
                    : 'Evidence upload is not durable.';
            }
        }

        $revisionInput = array_map(static fn (array $asset): array => [
            'id' => $asset['id'],
            'type' => $asset['type'],
            'sha256' => $asset['sha256'],
        ], $assets);
        $revision = hash('sha256', (string) json_encode($revisionInput, JSON_UNESCAPED_SLASHES));

        return [
            'report_id' => $report->id,
            'revision' => $revision,
            'ready' => $errors === [] && $assets !== [],
            'required' => [
                'photo_count' => $requiredPhotoCount,
                'video' => $requiresVideo,
            ],
            'counts' => [
                'photos' => $photos->count(),
                'videos' => $videos->count(),
                'documents' => $documents->count(),
                'total' => $media->count(),
            ],
            'assets' => $assets,
            'errors' => $errors,
        ];
    }

    public function isReady(Report $report): bool
    {
        return (bool) $this->manifest($report)['ready'];
    }
}
