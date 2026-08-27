<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Services;

use App\Modules\Media\Models\Media;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\TextileCollections\Events\TextileCollectionCollected;
use App\Modules\TextileCollections\Events\TextileCollectionRejected;
use App\Modules\TextileCollections\Events\TextileCollectionScheduled;
use App\Modules\TextileCollections\Models\TextileCollectionBatch;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class TextileCollectionOperationsService
{
    public function approve(TextileCollectionRequest $collection, User $actor): TextileCollectionRequest
    {
        if ($collection->status !== TextileCollectionRequest::STATUS_PENDING_REVIEW) {
            throw ApiException::validation('Only requests awaiting review can be approved.');
        }

        $collection->update(['status' => TextileCollectionRequest::STATUS_READY_TO_GROUP]);
        $this->audit($actor, $collection->id, 'textile.approve', ['status' => TextileCollectionRequest::STATUS_PENDING_REVIEW], [
            'status' => TextileCollectionRequest::STATUS_READY_TO_GROUP,
        ]);

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
                'status' => 'planned',
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
    ): TextileCollectionRequest {
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
            ],
            'missed' => [
                'status' => TextileCollectionRequest::STATUS_MISSED,
                'missed_pickup_reason' => $reason,
                'batch_id' => null,
            ],
            'rejected' => [
                'status' => TextileCollectionRequest::STATUS_REJECTED,
                'rejection_reason' => $reason,
                'batch_id' => null,
            ],
            'cancelled' => [
                'status' => TextileCollectionRequest::STATUS_CANCELLED,
                'cancellation_reason' => $reason,
                'batch_id' => null,
            ],
            default => throw ApiException::validation('Unsupported collection outcome.'),
        };

        $collection->update($updates);
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
        $allowedStatuses = match ($outcome) {
            'collected', 'missed' => [TextileCollectionRequest::STATUS_SCHEDULED],
            'rejected' => [TextileCollectionRequest::STATUS_PENDING_REVIEW],
            'cancelled' => [
                TextileCollectionRequest::STATUS_PENDING_REVIEW,
                TextileCollectionRequest::STATUS_READY_TO_GROUP,
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
