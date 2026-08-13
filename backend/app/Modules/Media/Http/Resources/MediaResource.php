<?php

declare(strict_types=1);

namespace App\Modules\Media\Http\Resources;

use App\Modules\Media\Models\Media;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * MediaResource — the API representation of a Media row.
 *
 * Per AGENTS.md ("Never return Models directly") and docs/05
 * §14 — the citizen PWA and the moderator portal both read
 * media through this resource so the wire format is stable.
 *
 * @property-read Media $resource
 */
class MediaResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Media $media */
        $media = $this->resource;

        return [
            'id' => $media->id,
            'report_id' => $media->report_id,
            'assignment_id' => $media->assignment_id,
            'department_id' => $media->department_id,
            'type' => $media->type,
            'role' => $media->role ?? 'evidence',
            'mime' => $media->mime,
            'size' => (int) $media->size,
            'width' => $media->width,
            'height' => $media->height,
            'duration' => $media->duration,
            'checksum' => $media->checksum,
            'scan_status' => strtolower($media->scan_status->value),
            'scan_attempted_at' => $media->scan_attempted_at?->toIso8601String(),
            'storage_disk' => $media->storage_disk,
            'storage_path' => $media->storage_path,
            'captured_at' => $media->captured_at?->toIso8601String(),
            'uploaded_at' => $media->uploaded_at->toIso8601String(),
            'uploaded_by' => $media->uploaded_by,
            'version' => (int) $media->version,
            'is_replaced' => (bool) $media->is_replaced,
            'metadata' => $media->metadata ?? [],
        ];
    }
}
