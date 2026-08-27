<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Services;

use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\TextileCollections\DTO\TextileCollectionInput;
use App\Modules\TextileCollections\Events\TextileCollectionAcknowledged;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\TextileCollections\Models\TextileServiceZone;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;

final class TextileCollectionService
{
    public function create(
        User $citizen,
        TextileCollectionInput $input,
        string $title,
        ?string $notes,
        ?float $latitude,
        ?float $longitude,
    ): TextileCollectionRequest {
        $method = $input->collectionMethod;
        $category = $input->category;

        $zone = TextileServiceZone::query()
            ->whereKey($input->serviceZoneId)
            ->where('active', true)
            ->first();

        if ($zone === null) {
            throw new ApiException('SERVICE_ZONE_UNAVAILABLE', 'The selected pickup zone is not active.', 422);
        }

        if ($method === 'dropoff' && ! $zone->dropoff_enabled) {
            throw new ApiException('COLLECTION_METHOD_UNAVAILABLE', 'Drop-off is not available in this zone.', 422);
        }

        if ($method === 'premises' && ! $zone->premises_pickup_enabled) {
            throw new ApiException('COLLECTION_METHOD_UNAVAILABLE', 'Premises pickup is not available in this zone.', 422);
        }

        // ── Partner assignment: zone owner must have capability ──────
        $departmentId = null;

        if ($zone->department_id !== null) {
            $hasCapability = DB::table('textile_partner_capabilities')
                ->where('department_id', $zone->department_id)
                ->where('category', $category)
                ->exists();

            if ($hasCapability) {
                $departmentId = $zone->department_id;
            } else {
                throw new ApiException(
                    'CATEGORY_NOT_SERVED',
                    'No collection partner serves this category at the selected zone.',
                    422,
                );
            }
        } else {
            // Zone has no owner — reject unless no capability check needed.
            throw new ApiException(
                'CATEGORY_NOT_SERVED',
                'No collection partner serves this category at the selected zone.',
                422,
            );
        }

        $row = DB::transaction(fn (): TextileCollectionRequest => TextileCollectionRequest::query()->create([
            'citizen_id' => $citizen->id,
            'title' => trim($title),
            'notes' => $notes === null ? null : trim($notes),
            'category' => $category,
            'service_zone_id' => $zone->id,
            'department_id' => $departmentId,
            'requester_type' => $input->requesterType,
            'requester_name' => $input->requesterName,
            'rwa_name' => $input->rwaName,
            'contact_email' => mb_strtolower($input->contactEmail),
            'contact_phone' => $input->contactPhone,
            'pickup_address' => $input->pickupAddress,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'collection_method' => $method,
            'estimated_bags' => $input->estimatedBags,
            'estimated_weight_kg' => $input->estimatedWeightKg,
            'status' => TextileCollectionRequest::STATUS_PENDING_REVIEW,
            'readiness_instructions' => $zone->readiness_instructions,
            'submitted_at' => now(),
        ]));

        TextileCollectionAcknowledged::dispatch($row);

        return $row;
    }
}
