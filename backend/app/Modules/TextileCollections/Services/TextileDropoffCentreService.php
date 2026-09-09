<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Services;

use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\TextileCollections\Models\TextileDropoffCentre;
use App\Modules\TextileCollections\Models\TextileServiceZone;
use App\Modules\Users\Models\User;

/**
 * Partner-scoped management of service zones and their drop-off centres.
 *
 * Staff may list/add/edit only zones and centres owned by their working
 * department (zones with no owner follow the legacy updateZone convention
 * and remain manageable). Every mutation is audit-logged.
 */
final class TextileDropoffCentreService
{
    /** @var list<string> */
    private const ZONE_FIELDS = [
        'code', 'name', 'center_latitude', 'center_longitude', 'service_radius_km',
        'dropoff_enabled', 'premises_pickup_enabled', 'dropoff_name',
        'dropoff_address', 'readiness_instructions', 'active',
        'operating_hours', 'public_phone', 'centre_status', 'centre_closed_note',
        'receipt_requires_photo', 'receipt_requires_bags', 'receipt_requires_weight',
        'max_open_dropoffs_per_citizen',
    ];

    /** @var list<string> */
    private const CENTRE_FIELDS = [
        'name', 'address', 'latitude', 'longitude', 'operating_hours', 'public_phone',
        'status', 'closed_note', 'active', 'sort_order',
    ];

    /**
     * @return array<int, TextileServiceZone>
     */
    public function listZones(string $departmentId): array
    {
        /** @var array<int, TextileServiceZone> $zones */
        $zones = TextileServiceZone::query()
            ->where('department_id', $departmentId)
            ->with(['department', 'dropoffCentres'])
            ->orderBy('name')
            ->get()
            ->all();

        return $zones;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function createZone(string $departmentId, array $payload, User $actor): TextileServiceZone
    {
        $attributes = ['department_id' => $departmentId];

        foreach (self::ZONE_FIELDS as $field) {
            if (array_key_exists($field, $payload)) {
                $attributes[$field] = $payload[$field];
            }
        }

        $zone = TextileServiceZone::query()->create($attributes);

        $this->audit($actor, 'textile_service_zone', $zone->id, 'textile.zone_created', null, [
            'code' => $zone->code,
            'name' => $zone->name,
        ]);

        return $zone->load(['department', 'dropoffCentres']);
    }

    /**
     * @return array<int, TextileDropoffCentre>
     */
    public function listCentres(string $departmentId, string $zoneId): array
    {
        $zone = $this->ownedZone($zoneId, $departmentId);

        /** @var array<int, TextileDropoffCentre> $centres */
        $centres = $zone->dropoffCentres()->orderBy('sort_order')->orderBy('name')->get()->all();

        return $centres;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function createCentre(string $departmentId, string $zoneId, array $payload, User $actor): TextileDropoffCentre
    {
        $zone = $this->ownedZone($zoneId, $departmentId);

        $attributes = ['service_zone_id' => $zone->id];

        foreach (self::CENTRE_FIELDS as $field) {
            if (array_key_exists($field, $payload)) {
                $attributes[$field] = $payload[$field];
            }
        }

        $centre = TextileDropoffCentre::query()->create($attributes);

        $this->audit($actor, 'textile_dropoff_centre', $centre->id, 'textile.centre_created', null, [
            'service_zone_id' => $zone->id,
            'name' => $centre->name,
        ]);

        return $centre->load(['serviceZone']);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function updateCentre(TextileDropoffCentre $centre, string $departmentId, array $payload, User $actor): TextileDropoffCentre
    {
        $centre->loadMissing(['serviceZone']);
        $zone = $centre->serviceZone;

        if (! $zone instanceof TextileServiceZone) {
            throw ApiException::validation('This centre is not attached to a service zone.');
        }

        $this->assertZoneOwnership($zone, $departmentId);

        $before = $centre->only(['name', 'address', 'public_phone', 'status', 'active', 'sort_order']);

        $updates = [];

        foreach (self::CENTRE_FIELDS as $field) {
            if (array_key_exists($field, $payload)) {
                $updates[$field] = $payload[$field];
            }
        }

        if ($updates !== []) {
            $centre->update($updates);
        }

        $this->audit($actor, 'textile_dropoff_centre', $centre->id, 'textile.centre_updated', $before, [
            'name' => $centre->fresh()?->name,
            'status' => $centre->fresh()?->status,
        ]);

        return $centre->refresh()->load(['serviceZone']);
    }

    private function ownedZone(string $zoneId, string $departmentId): TextileServiceZone
    {
        $zone = TextileServiceZone::query()->find($zoneId);

        if (! $zone instanceof TextileServiceZone) {
            throw ApiException::notFound('Service zone not found.');
        }

        $this->assertZoneOwnership($zone, $departmentId);

        return $zone;
    }

    private function assertZoneOwnership(TextileServiceZone $zone, string $departmentId): void
    {
        if ($zone->department_id !== null && (string) $zone->department_id !== (string) $departmentId) {
            throw ApiException::forbidden('This zone belongs to another partner.');
        }
    }

    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>  $after
     */
    private function audit(User $actor, string $entity, string $entityId, string $action, ?array $before, array $after): void
    {
        $request = request();
        $requestId = $request->attributes->get('trace_id');

        AuditLog::query()->create([
            'user_id' => $actor->id,
            'entity' => $entity,
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
