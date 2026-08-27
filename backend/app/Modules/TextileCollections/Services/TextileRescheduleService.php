<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Services;

use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\TextileCollections\Events\TextileCollectionRescheduled;
use App\Modules\TextileCollections\Models\TextileCollectionBatch;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\Users\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class TextileRescheduleService
{
    // TODO D-05 OPEN: partner-approved cutoff (hours before scheduled_date) pending decision. Default 24h.
    private const CUTOFF_HOURS = 24;

    public function __construct(private readonly TextileUnavailabilityService $unavailability) {}

    /**
     * Citizen self-service reschedule for an eligible doorstep pickup.
     *
     * Guardrails:
     * - only premises lane, status scheduled
     * - before cutoff (24h) unless partner override
     * - not when batch is in_progress/completed unless override
     * - slot must not be unavailable
     * - atomic: detach from old batch and update schedule in one transaction
     * - audit old/new schedule (before/after)
     */
    public function reschedule(
        TextileCollectionRequest $collection,
        User $actor,
        string $newDate,
        ?string $newWindowStart,
        ?string $newWindowEnd,
        ?string $reason = null,
        bool $isPartnerOverride = false,
    ): TextileCollectionRequest {
        if ($collection->collection_method !== 'premises') {
            throw ApiException::validation('Only premises pickups can be rescheduled.');
        }

        if ($collection->status !== TextileCollectionRequest::STATUS_SCHEDULED) {
            throw ApiException::validation('Only scheduled pickups can be rescheduled.');
        }

        if (in_array($collection->status, [
            TextileCollectionRequest::STATUS_CANCELLED,
            TextileCollectionRequest::STATUS_REJECTED,
            TextileCollectionRequest::STATUS_PICKED_UP,
            TextileCollectionRequest::STATUS_RECEIVED_AT_CENTRE,
        ], true)) {
            throw ApiException::validation('This request can no longer be rescheduled.');
        }

        // Cutoff: must be before scheduled_date minus CUTOFF_HOURS
        if (! $isPartnerOverride && $collection->scheduled_date instanceof Carbon) {
            $cutoff = $collection->scheduled_date->copy()->subHours(self::CUTOFF_HOURS)->startOfDay();

            // Use scheduled_date at midnight as boundary; allow reschedule up to cutoff.
            if (Carbon::now()->greaterThan($cutoff)) {
                throw new ApiException(
                    'RESCHEDULE_CUTOFF_PASSED',
                    'Rescheduling is no longer available for this pickup (cutoff passed). Please contact support.',
                    422,
                );
            }
        }

        // Freeze when field execution has started (batch in_progress/completed)
        if ($collection->batch_id !== null) {
            $batch = TextileCollectionBatch::query()->find($collection->batch_id);

            if ($batch !== null && in_array($batch->status, [TextileCollectionBatch::STATUS_IN_PROGRESS, TextileCollectionBatch::STATUS_COMPLETED], true)) {
                if (! $isPartnerOverride) {
                    throw new ApiException(
                        'RESCHEDULE_FROZEN',
                        'This trip has already started and cannot be rescheduled without partner override.',
                        422,
                    );
                }
            }
        }

        // Unavailable slot check
        $this->unavailability->assertAvailable($collection->service_zone_id, $newDate, $newWindowStart, $newWindowEnd);

        // Atomic trip reconcile — detach from old batch, update schedule, increment count
        return DB::transaction(function () use ($collection, $actor, $newDate, $newWindowStart, $newWindowEnd, $reason): TextileCollectionRequest {
            $locked = TextileCollectionRequest::query()->whereKey($collection->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== TextileCollectionRequest::STATUS_SCHEDULED) {
                throw ApiException::validation('Request is no longer in a reschedulable state.');
            }

            $oldSchedule = [
                'scheduled_date' => $locked->scheduled_date?->toDateString(),
                'scheduled_window_start' => $locked->scheduled_window_start,
                'scheduled_window_end' => $locked->scheduled_window_end,
                'batch_id' => $locked->batch_id,
            ];

            $oldBatchId = $locked->previous_batch_id ?? $locked->batch_id;

            // Lock old batch row to prevent concurrent trip mutation
            if ($locked->batch_id !== null) {
                TextileCollectionBatch::query()->whereKey($locked->batch_id)->lockForUpdate()->first();
            }

            $locked->update([
                'previous_scheduled_date' => $locked->scheduled_date,
                'previous_window_start' => $locked->scheduled_window_start,
                'previous_window_end' => $locked->scheduled_window_end,
                'previous_batch_id' => $locked->batch_id,
                'scheduled_date' => $newDate,
                'scheduled_window_start' => $newWindowStart,
                'scheduled_window_end' => $newWindowEnd,
                'batch_id' => null, // detach atomically; scheduler will re-group
                'rescheduled_at' => now(),
                'reschedule_count' => ($locked->reschedule_count ?? 0) + 1,
                // Keep readiness_instructions untouched; separate endpoint for that.
            ]);

            $newSchedule = [
                'scheduled_date' => $newDate,
                'scheduled_window_start' => $newWindowStart,
                'scheduled_window_end' => $newWindowEnd,
                'batch_id' => null,
                'reason' => $reason,
            ];

            // Audit old/new schedule — before contains old, after contains new + reschedule_count
            $this->audit($actor, $locked->id, 'textile.reschedule', $oldSchedule, array_merge($newSchedule, [
                'reschedule_count' => $locked->refresh()->reschedule_count,
                'previous_batch_id' => $oldBatchId,
            ]));

            $refreshed = $locked->refresh()->load(['serviceZone', 'batch', 'department', 'citizen']);

            TextileCollectionRescheduled::dispatch($refreshed, $oldSchedule, $newSchedule);

            return $refreshed;
        });
    }

    /**
     * Update permitted readiness/contact fields without touching historical evidence.
     *
     * Allowed: readiness_instructions, contact_phone, contact_email, pickup_address.
     * Not allowed: actual_* , estimated_* , status, batch_id, proof media.
     */
    public function updateInstructions(
        TextileCollectionRequest $collection,
        User $actor,
        ?string $readinessInstructions,
        ?string $contactPhone,
        ?string $contactEmail,
        ?string $pickupAddress,
    ): TextileCollectionRequest {
        if (in_array($collection->status, [
            TextileCollectionRequest::STATUS_PICKED_UP,
            TextileCollectionRequest::STATUS_CANCELLED,
            TextileCollectionRequest::STATUS_REJECTED,
            TextileCollectionRequest::STATUS_RECEIVED_AT_CENTRE,
        ], true)) {
            throw ApiException::validation('Instructions cannot be changed at the current stage.');
        }

        $before = [
            'readiness_instructions' => $collection->readiness_instructions,
            'contact_phone' => $collection->contact_phone,
            'contact_email' => $collection->contact_email,
            'pickup_address' => $collection->pickup_address,
        ];

        $updates = [];

        if ($readinessInstructions !== null) {
            $updates['readiness_instructions'] = $readinessInstructions;
        }

        if ($contactPhone !== null) {
            $updates['contact_phone'] = $contactPhone;
        }

        if ($contactEmail !== null) {
            $updates['contact_email'] = mb_strtolower($contactEmail);
        }

        if ($pickupAddress !== null) {
            $updates['pickup_address'] = $pickupAddress;
        }

        if ($updates === []) {
            return $collection;
        }

        $collection->update($updates);

        $this->audit($actor, $collection->id, 'textile.update_instr', $before, $updates);

        return $collection->refresh()->load(['serviceZone', 'batch', 'department']);
    }

    /** @param array<string,mixed>|null $before @param array<string,mixed> $after */
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
