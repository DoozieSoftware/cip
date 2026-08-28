<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Services;

use App\Modules\Media\Models\Media;
use App\Modules\Media\Services\ChainOfCustodyWriter;
use App\Modules\Media\Enums\MediaScanStatus;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\TextileCollections\Events\TextileCollectionCollected;
use App\Modules\TextileCollections\Events\TextileCollectionDropoffConfirmed;
use App\Modules\TextileCollections\Events\TextileCollectionRejected;
use App\Modules\TextileCollections\Events\TextileCollectionScheduled;
use App\Modules\TextileCollections\Models\TextileCollectionBatch;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class TextileCollectionOperationsService
{
    public function __construct(
        private readonly ChainOfCustodyWriter $chainOfCustody = new ChainOfCustodyWriter(),
    ) {}
    public function approve(TextileCollectionRequest $collection, User $actor): TextileCollectionRequest
    {
        // Lane-aware approve: dropoff -> dropoff_awaiting_drop, premises -> ready_to_group
        if ($collection->collection_method === 'dropoff') {
            return $this->confirmDropoff($collection, $actor);
        }

        return $this->approvePickup($collection, $actor);
    }

    public function confirmDropoff(TextileCollectionRequest $collection, User $actor, ?string $validFrom = null, ?string $validUntil = null): TextileCollectionRequest
    {
        if ($collection->status !== TextileCollectionRequest::STATUS_PENDING_REVIEW) {
            throw ApiException::validation('Only requests awaiting review can be approved.');
        }

        if ($collection->collection_method !== 'dropoff') {
            throw ApiException::validation('confirmDropoff only for dropoff method.');
        }
        $collection->update([
            'status' => TextileCollectionRequest::STATUS_DROPOFF_AWAITING_DROP,
            'dropoff_confirmed_at' => now(),
            'dropoff_valid_from' => $validFrom,
            'dropoff_valid_until' => $validUntil,
        ]);
        $this->audit($actor, $collection->id, 'textile.approve_dropoff', ['status' => TextileCollectionRequest::STATUS_PENDING_REVIEW], ['status' => TextileCollectionRequest::STATUS_DROPOFF_AWAITING_DROP]);
        TextileCollectionDropoffConfirmed::dispatch($collection->refresh());

        return $collection->refresh()->load(['citizen', 'serviceZone', 'batch']);
    }

    public function approvePickup(TextileCollectionRequest $collection, User $actor): TextileCollectionRequest
    {
        if ($collection->status !== TextileCollectionRequest::STATUS_PENDING_REVIEW) {
            throw ApiException::validation('Only requests awaiting review can be approved.');
        }
        $collection->update(['status' => TextileCollectionRequest::STATUS_READY_TO_GROUP]);
        $this->audit($actor, $collection->id, 'textile.approve', ['status' => TextileCollectionRequest::STATUS_PENDING_REVIEW], ['status' => TextileCollectionRequest::STATUS_READY_TO_GROUP]);

        return $collection->refresh()->load(['citizen', 'serviceZone', 'batch']);
    }

    /**
     * @param  list<string>  $collectionRequestIds
     */
    public function scheduleBatch(
        string $serviceZoneId,
        array $collectionRequestIds,
        string $collectionDate,
        ?string $windowStart,
        ?string $windowEnd,
        ?string $tripReference,
        ?string $instructions,
        User $actor,
    ): TextileCollectionBatch {
        return DB::transaction(function () use (
            $serviceZoneId,
            $collectionRequestIds,
            $collectionDate,
            $windowStart,
            $windowEnd,
            $tripReference,
            $instructions,
            $actor,
        ): TextileCollectionBatch {
            $requests = TextileCollectionRequest::query()
                ->whereIn('id', $collectionRequestIds)
                ->lockForUpdate()
                ->get();

            if ($requests->count() !== count($collectionRequestIds)) {
                throw ApiException::validation('One or more collection requests no longer exist.');
            }

            foreach ($requests as $collection) {
                if ($collection->service_zone_id !== $serviceZoneId) {
                    throw ApiException::validation('All requests in a trip must belong to the same service zone.');
                }

                if ($collection->collection_method === 'dropoff') {
                    throw ApiException::validation('Drop-off requests must never enter a trip.');
                }

                if (! in_array($collection->status, [
                    TextileCollectionRequest::STATUS_READY_TO_GROUP,
                    TextileCollectionRequest::STATUS_MISSED,
                ], true)) {
                    throw ApiException::validation('Only approved or missed requests can be scheduled.');
                }
            }

            $batch = TextileCollectionBatch::query()->create([
                'service_zone_id' => $serviceZoneId,
                'reference' => 'DRL-'.now()->format('ymd').'-'.Str::upper(Str::random(6)),
                'collection_date' => $collectionDate,
                'window_start' => $windowStart,
                'window_end' => $windowEnd,
                'status' => TextileCollectionBatch::STATUS_PLANNED,
                'trip_reference' => $tripReference,
                'instructions' => $instructions,
                'created_by' => $actor->id,
            ]);

            TextileCollectionRequest::query()
                ->whereIn('id', $collectionRequestIds)
                ->update([
                    'batch_id' => $batch->id,
                    'status' => TextileCollectionRequest::STATUS_SCHEDULED,
                    'scheduled_date' => $collectionDate,
                    'scheduled_window_start' => $windowStart,
                    'scheduled_window_end' => $windowEnd,
                    'readiness_instructions' => $instructions,
                    'updated_at' => now(),
                ]);

            $this->audit($actor, $batch->id, 'textile.schedule', null, [
                'service_zone_id' => $serviceZoneId,
                'collection_date' => $collectionDate,
                'request_count' => count($collectionRequestIds),
            ]);

            $loaded = $batch->load(['serviceZone', 'requests']);

            TextileCollectionScheduled::dispatch($loaded);

            return $loaded;
        });
    }

    public function recordOutcome(
        TextileCollectionRequest $collection,
        string $outcome,
        ?int $actualBags,
        ?float $actualWeightKg,
        ?string $reason,
        User $actor,
        ?string $idempotencyKey = null,
    ): TextileCollectionRequest {
        // Idempotency: retry with same key must not create a second outcome.
        if ($idempotencyKey !== null && $idempotencyKey !== '' && $collection->outcome_idempotency_key === $idempotencyKey) {
            // Already applied — return current state without duplicating audit/events.
            return $collection->refresh()->load(['serviceZone', 'batch']);
        }

        // If already finalized, a different idempotency key is a conflict (prevents double outcome).
        if (in_array($collection->status, [TextileCollectionRequest::STATUS_PICKED_UP, TextileCollectionRequest::STATUS_MISSED, TextileCollectionRequest::STATUS_REJECTED], true)
            && $collection->outcome_idempotency_key !== null
            && $idempotencyKey !== $collection->outcome_idempotency_key) {
            // For already-terminal records, only the original idempotency key is idempotent.
            // Without a matching key, treat as conflict to avoid overwriting a staff member's later outcome.
            if ($collection->status === TextileCollectionRequest::STATUS_PICKED_UP) {
                throw ApiException::validation('Collection outcome already recorded.');
            }
        }

        $this->assertOutcomeAllowed($collection, $outcome);

        if ($outcome === 'collected') {
            $this->assertProofPhotoExists($collection);
        }

        $before = ['status' => $collection->status];
        $updates = match ($outcome) {
            'collected' => [
                'status' => TextileCollectionRequest::STATUS_PICKED_UP,
                'actual_bags' => $actualBags,
                'actual_weight_kg' => $actualWeightKg,
                'picked_up_at' => now(),
                'outcome_idempotency_key' => $idempotencyKey,
            ],
            'missed' => [
                'status' => TextileCollectionRequest::STATUS_MISSED,
                'missed_pickup_reason' => $reason,
                'batch_id' => null,
                'outcome_idempotency_key' => $idempotencyKey,
            ],
            'rejected' => [
                'status' => TextileCollectionRequest::STATUS_REJECTED,
                'rejection_reason' => $reason,
                'batch_id' => null,
                'outcome_idempotency_key' => $idempotencyKey,
            ],
            'cancelled' => [
                'status' => TextileCollectionRequest::STATUS_CANCELLED,
                'cancellation_reason' => $reason,
                'batch_id' => null,
                'outcome_idempotency_key' => $idempotencyKey,
            ],
            default => throw ApiException::validation('Unsupported collection outcome.'),
        };

        // Guard against concurrent outcome overwrite via row-level idempotency check.
        $affected = DB::table('textile_collection_requests')
            ->where('id', $collection->id)
            ->where(function ($q) use ($collection): void {
                // Only allow transition from the status we validated above.
                $q->where('status', $collection->status);
            })
            ->update(array_merge($updates, ['updated_at' => now()]));

        if ($affected === 0) {
            // Concurrent update — check if idempotency now matches (retry won).
            $fresh = TextileCollectionRequest::query()->find($collection->id);
            if ($fresh !== null && $idempotencyKey !== null && $fresh->outcome_idempotency_key === $idempotencyKey) {
                return $fresh->load(['serviceZone', 'batch']);
            }
            throw ApiException::validation('Concurrent outcome conflict; please retry.');
        }
        $collection->refresh();
        $this->audit($actor, $collection->id, 'textile.outcome', $before, [
            'status' => $collection->status,
            'actual_bags' => $collection->actual_bags,
            'actual_weight_kg' => $collection->actual_weight_kg,
            'reason' => $reason,
        ]);

        $refreshed = $collection->refresh()->load(['serviceZone', 'batch']);

        if ($outcome === 'collected') {
            TextileCollectionCollected::dispatch($refreshed);
        }

        if ($outcome === 'rejected') {
            TextileCollectionRejected::dispatch($refreshed, (string) ($reason ?? ''));
        }

        return $refreshed;
    }

    private function assertOutcomeAllowed(TextileCollectionRequest $collection, string $outcome): void
    {
        if ($outcome === 'collected' && $collection->collection_method === 'dropoff') {
            throw ApiException::validation('Use receipt for drop-off collections.');
        }
        $allowedStatuses = match ($outcome) {
            'collected', 'missed' => [TextileCollectionRequest::STATUS_SCHEDULED],
            'rejected' => [TextileCollectionRequest::STATUS_PENDING_REVIEW],
            'cancelled' => [
                TextileCollectionRequest::STATUS_PENDING_REVIEW,
                TextileCollectionRequest::STATUS_READY_TO_GROUP,
                TextileCollectionRequest::STATUS_DROPOFF_AWAITING_DROP,
                TextileCollectionRequest::STATUS_SCHEDULED,
                TextileCollectionRequest::STATUS_MISSED,
            ],
            default => throw ApiException::validation('Unsupported collection outcome.'),
        };

        if (! in_array($collection->status, $allowedStatuses, true)) {
            throw ApiException::validation('This action is not available at the current collection stage.');
        }
    }

    private function assertProofPhotoExists(TextileCollectionRequest $collection): void
    {
        $hasProof = Media::query()
            ->where('textile_collection_id', $collection->id)
            ->where('role', 'proof')
            ->where('is_replaced', false)
            ->exists();

        if (! $hasProof) {
            throw new ApiException(
                'PROOF_PHOTO_REQUIRED',
                'A proof photo is required to record a collection.',
                422,
            );
        }
    }

    /**
     * Phase 4 offline-safe: atomic proof + outcome. Idempotent when
     * the Idempotency-Key middleware replays the stored 2xx; within
     * the handler we also guard against double-collect via status
     * check so a retry that somehow re-enters (e.g. pending_expiry)
     * returns the already-picked_up row instead of creating a second
     * proof/media chain.
     */
    public function recordCollectedWithProof(
        TextileCollectionRequest $collection,
        User $actor,
        int $actualBags,
        float $actualWeightKg,
        \Illuminate\Http\UploadedFile $photo,
        ?string $reason = null,
    ): TextileCollectionRequest {
        if ($collection->collection_method === 'dropoff') {
            throw ApiException::validation('Use receipt for drop-off collections.');
        }

        // If already collected, return idempotently — the proof chain
        // is authoritative and we must not create a second media row.
        if ($collection->status === TextileCollectionRequest::STATUS_PICKED_UP) {
            return $collection->load(['serviceZone', 'batch', 'photos']);
        }

        if ($collection->status !== TextileCollectionRequest::STATUS_SCHEDULED) {
            throw ApiException::validation('This action is not available at the current collection stage.');
        }

        return DB::transaction(function () use ($collection, $actor, $actualBags, $actualWeightKg, $photo, $reason): TextileCollectionRequest {
            $locked = TextileCollectionRequest::query()->whereKey($collection->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === TextileCollectionRequest::STATUS_PICKED_UP) {
                return $locked->load(['serviceZone', 'batch', 'photos']);
            }
            if ($locked->status !== TextileCollectionRequest::STATUS_SCHEDULED) {
                throw ApiException::validation('This action is not available at the current collection stage.');
            }

            // Store proof via textile media pipeline (reuse same logic as TextileCollectionMediaService::store
            // but inline to keep the whole collect atomic). We delegate to Media model creation directly
            // to avoid duplicating storage logic — but we keep checksum/audit.
            $media = $this->storeProofMedia($collection->id, $photo, (string) $actor->id);

            $before = ['status' => $locked->status];
            $locked->update([
                'status' => TextileCollectionRequest::STATUS_PICKED_UP,
                'actual_bags' => $actualBags,
                'actual_weight_kg' => $actualWeightKg,
                'picked_up_at' => now(),
            ]);

            $this->audit($actor, $locked->id, 'textile.outcome', $before, [
                'status' => TextileCollectionRequest::STATUS_PICKED_UP,
                'actual_bags' => $actualBags,
                'actual_weight_kg' => $actualWeightKg,
                'proof_media_id' => $media->id,
                'reason' => $reason,
            ]);

            $refreshed = $locked->refresh()->load(['serviceZone', 'batch', 'photos']);
            TextileCollectionCollected::dispatch($refreshed);

            return $refreshed;
        });
    }

    private function storeProofMedia(string $collectionId, \Illuminate\Http\UploadedFile $file, string $uploaderId): Media
    {
        $id = (string) \Illuminate\Support\Str::uuid();
        $extension = strtolower((string) $file->getClientOriginalExtension()) ?: match (strtolower((string) $file->getMimeType())) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => 'bin',
        };
        /** @var string $diskName */
        $diskName = config('cip.media.disk', 'local');
        $storagePath = sprintf('proof/textile/%s/photo/%s.%s', $collectionId, $id, $extension);
        $sourcePath = $file->getRealPath();
        if (! is_string($sourcePath) || $sourcePath === '' || ! is_file($sourcePath)) {
            throw ApiException::serverError('Unable to stage the uploaded photo.');
        }
        $sha256 = hash_file('sha256', $sourcePath);
        if (! is_string($sha256) || preg_match('/^[a-f0-9]{64}$/', $sha256) !== 1) {
            throw ApiException::serverError('Unable to establish uploaded photo integrity.');
        }
        $stream = fopen($sourcePath, 'rb');
        if ($stream === false) {
            throw ApiException::serverError('Unable to read uploaded photo.');
        }
        try {
            $written = \Illuminate\Support\Facades\Storage::disk($diskName)->put($storagePath, $stream);
        } finally {
            fclose($stream);
        }
        if (! $written) {
            throw ApiException::serverError('Failed to store uploaded photo.');
        }
        $dimensions = @getimagesize($sourcePath);
        $width = is_array($dimensions) && $dimensions[0] > 0 ? $dimensions[0] : null;
        $height = is_array($dimensions) && $dimensions[1] > 0 ? $dimensions[1] : null;

        $media = Media::query()->create([
            'id' => $id,
            'report_id' => null,
            'textile_collection_id' => $collectionId,
            'type' => 'PHOTO',
            'role' => 'proof',
            'storage_disk' => $diskName,
            'storage_path' => $storagePath,
            'mime' => (string) $file->getMimeType(),
            'size' => (int) $file->getSize(),
            'width' => $width,
            'height' => $height,
            'checksum' => $sha256,
            'scan_status' => MediaScanStatus::CLEAN,
            'uploaded_at' => now(),
            'uploaded_by' => $uploaderId,
            'metadata' => ['source' => 'textile_collect_offline_safe'],
            'version' => 1,
            'is_replaced' => false,
        ]);

        $this->chainOfCustody->record($media, ChainOfCustodyWriter::EVENT_UPLOAD, metadata: [
            'sha256' => $sha256,
            'storage_path' => $storagePath,
            'context' => 'textile_collect',
        ]);

        \App\Modules\Media\Jobs\ComputeHashesJob::dispatch($media->id);
        \App\Modules\Media\Jobs\GenerateThumbnailJob::dispatch($media->id);

        return $media;
    }

    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>  $after
     */
    private function audit(User $actor, string $entityId, string $action, ?array $before, array $after): void
    {
        $request = request();
        $requestId = $request->attributes->get('trace_id');

        AuditLog::query()->create([
            'user_id' => $actor->id,
            'entity' => 'textile_collection',
            'entity_id' => $entityId,
            'action' => $action,
            'before' => $before,
            'after' => $after,
            'ip' => $request->ip(),
            'device_fingerprint' => null,
            'request_id' => is_string($requestId) ? $requestId : null,
            'created_at' => now(),
        ]);
    }
}
