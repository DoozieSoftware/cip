<?php

declare(strict_types=1);

namespace App\Modules\Media\Repositories;

use App\Modules\Media\Enums\MediaQuarantineReason;
use App\Modules\Media\Enums\MediaQuarantineStatus;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaQuarantine;
use Illuminate\Database\Eloquent\Builder;

final class MediaQuarantineRepository
{
    public function createFor(Media $media, string $scanner, string $sha256): MediaQuarantine
    {
        return MediaQuarantine::query()->create([
            'media_id' => $media->id,
            'status' => MediaQuarantineStatus::RESCANNING,
            'reason' => MediaQuarantineReason::AWAITING_SCAN,
            'scanner' => $scanner,
            'original_sha256' => $sha256,
            'scan_attempts' => 1,
            'last_error' => null,
            'quarantined_at' => now(),
            'last_attempted_at' => now(),
            'released_at' => null,
        ]);
    }

    public function findWithMedia(string $id): ?MediaQuarantine
    {
        return MediaQuarantine::query()->with('media')->find($id);
    }

    public function claimForRescan(string $id, int $staleAfterSeconds): ?MediaQuarantine
    {
        $now = now();
        $staleBefore = $now->copy()->subSeconds(max(60, $staleAfterSeconds));

        $claimed = MediaQuarantine::query()
            ->whereKey($id)
            ->where(function (Builder $query) use ($staleBefore): void {
                $query->where('status', MediaQuarantineStatus::PENDING_RESCAN->value)
                    ->orWhere(function (Builder $stale) use ($staleBefore): void {
                        $stale->where('status', MediaQuarantineStatus::RESCANNING->value)
                            ->where(function (Builder $attempt) use ($staleBefore): void {
                                $attempt->whereNull('last_attempted_at')
                                    ->orWhere('last_attempted_at', '<=', $staleBefore);
                            });
                    });
            })
            ->increment('scan_attempts', 1, [
                'status' => MediaQuarantineStatus::RESCANNING->value,
                'last_attempted_at' => $now,
                'last_error' => null,
                'updated_at' => $now,
            ]);

        return $claimed === 1 ? $this->findWithMedia($id) : null;
    }

    /** @return list<string> */
    public function eligibleIds(int $limit, int $staleAfterSeconds, ?string $mediaId = null): array
    {
        $staleBefore = now()->subSeconds(max(60, $staleAfterSeconds));

        return MediaQuarantine::query()
            ->when($mediaId !== null, fn (Builder $query): Builder => $query->where('media_id', $mediaId))
            ->where(function (Builder $query) use ($staleBefore): void {
                $query->where('status', MediaQuarantineStatus::PENDING_RESCAN->value)
                    ->orWhere(function (Builder $stale) use ($staleBefore): void {
                        $stale->where('status', MediaQuarantineStatus::RESCANNING->value)
                            ->where(function (Builder $attempt) use ($staleBefore): void {
                                $attempt->whereNull('last_attempted_at')
                                    ->orWhere('last_attempted_at', '<=', $staleBefore);
                            });
                    });
            })
            ->orderBy('quarantined_at')
            ->limit(max(1, $limit))
            ->pluck('id')
            ->map(static fn (mixed $id): string => (string) $id)
            ->all();
    }
}
