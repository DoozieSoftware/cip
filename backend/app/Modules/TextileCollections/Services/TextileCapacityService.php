<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Services;

use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\TextileCollections\Models\TextileCapacityException;
use App\Modules\TextileCollections\Models\TextileCapacityRule;
use App\Modules\TextileCollections\Models\TextileCollectionBatch;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\TextileCollections\Models\TextileServiceZone;
use App\Modules\Users\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class TextileCapacityService
{
    /**
     * @return array<int, TextileCapacityRule>
     */
    public function listRules(string $departmentId, ?string $serviceZoneId = null): array
    {
        $query = TextileCapacityRule::query()
            ->where('department_id', $departmentId)
            ->with(['serviceZone'])
            ->orderBy('service_zone_id')
            ->orderBy('effective_from');

        if (is_string($serviceZoneId) && $serviceZoneId !== '') {
            $query->where('service_zone_id', $serviceZoneId);
        }

        /** @var array<int, TextileCapacityRule> $rules */
        $rules = $query->get()->all();

        return $rules;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function createRule(string $departmentId, string $serviceZoneId, array $payload, User $actor): TextileCapacityRule
    {
        $rule = TextileCapacityRule::query()->create([
            'service_zone_id' => $serviceZoneId,
            'department_id' => $departmentId,
            'effective_from' => $payload['effective_from'] ?? null,
            'effective_to' => $payload['effective_to'] ?? null,
            'day_of_week' => isset($payload['day_of_week']) && is_numeric($payload['day_of_week']) ? (int) $payload['day_of_week'] : null,
            'max_bags' => isset($payload['max_bags']) && is_numeric($payload['max_bags']) ? (int) $payload['max_bags'] : null,
            'max_weight_kg' => isset($payload['max_weight_kg']) && is_numeric($payload['max_weight_kg']) ? (float) $payload['max_weight_kg'] : null,
            'max_stops' => isset($payload['max_stops']) && is_numeric($payload['max_stops']) ? (int) $payload['max_stops'] : null,
            'min_bags' => isset($payload['min_bags']) && is_numeric($payload['min_bags']) ? (int) $payload['min_bags'] : null,
            'min_weight_kg' => isset($payload['min_weight_kg']) && is_numeric($payload['min_weight_kg']) ? (float) $payload['min_weight_kg'] : null,
            'vehicle_requirements' => $payload['vehicle_requirements'] ?? null,
            'category_allowlist' => $payload['category_allowlist'] ?? null,
            'guidance_text' => isset($payload['guidance_text']) && is_string($payload['guidance_text']) ? $payload['guidance_text'] : null,
            'policy_notes' => isset($payload['policy_notes']) && is_string($payload['policy_notes']) ? $payload['policy_notes'] : null,
            'created_by' => $actor->id,
            'updated_by' => $actor->id,
        ]);

        $this->audit($actor, $rule->id, 'textile.capacity_rule_created', null, [
            'service_zone_id' => $serviceZoneId,
            'max_bags' => $rule->max_bags,
            'min_bags' => $rule->min_bags,
        ]);

        return $rule->load(['serviceZone']);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function updateRule(TextileCapacityRule $rule, array $payload, User $actor): TextileCapacityRule
    {
        $before = $rule->only(['max_bags', 'max_weight_kg', 'max_stops', 'min_bags', 'min_weight_kg', 'vehicle_requirements']);

        $updates = [];

        foreach (['effective_from', 'effective_to', 'day_of_week', 'max_bags', 'max_weight_kg', 'max_stops', 'min_bags', 'min_weight_kg', 'vehicle_requirements', 'category_allowlist', 'guidance_text', 'policy_notes'] as $field) {
            if (array_key_exists($field, $payload)) {
                $updates[$field] = $payload[$field];
            }
        }
        $updates['updated_by'] = $actor->id;

        $rule->update($updates);

        $this->audit($actor, $rule->id, 'textile.capacity_rule_updated', $before, [
            'max_bags' => $rule->fresh()?->max_bags,
            'min_bags' => $rule->fresh()?->min_bags,
        ]);

        return $rule->refresh()->load(['serviceZone']);
    }

    public function deleteRule(TextileCapacityRule $rule, User $actor): void
    {
        $before = $rule->only(['service_zone_id', 'max_bags', 'min_bags']);
        $ruleId = $rule->id;
        $rule->delete();

        $this->audit($actor, $ruleId, 'textile.capacity_rule_deleted', $before, ['deleted' => true]);
    }

    /**
     * Evaluate a batch against capacity rules. Returns warnings and blockers with explainable messages.
     *
     * @return array{ok: bool, warnings: list<array{code: string, message: string, severity: string}>, blockers: list<array{code: string, message: string}>, totals: array{bags: int, weight_kg: float, stops: int}, effective_rule: array<string,mixed>|null, suggested_order: list<string>}
     */
    public function evaluateBatch(TextileCollectionBatch $batch): array
    {
        $batch->loadMissing(['serviceZone', 'requests']);

        $zoneId = $batch->service_zone_id;
        $deptId = $batch->serviceZone?->department_id;

        $effectiveRule = null;

        if (is_string($deptId) && $deptId !== '') {
            $effectiveRule = $this->getEffectiveRule($zoneId, (string) $deptId, $batch->collection_date);
        }

        $requests = $batch->requests;
        $totalBags = 0;
        $totalWeight = 0.0;
        $stops = $requests->count();
        $categories = [];

        foreach ($requests as $req) {
            $totalBags += (int) ($req->estimated_bags ?? 0);
            $totalWeight += (float) ($req->estimated_weight_kg ?? 0);

            if (is_string($req->category) && $req->category !== '') {
                $categories[$req->category] = true;
            }
        }

        $warnings = [];
        $blockers = [];

        if ($effectiveRule instanceof TextileCapacityRule) {
            if ($effectiveRule->max_bags !== null && $totalBags > $effectiveRule->max_bags) {
                $blockers[] = [
                    'code' => 'exceeds_max_bags',
                    'message' => "Trip has {$totalBags} bags but zone limit is {$effectiveRule->max_bags} bags for this day. Remove stops or request a capacity override.",
                ];
            } elseif ($effectiveRule->max_bags !== null && $totalBags >= (int) ($effectiveRule->max_bags * 0.85)) {
                $warnings[] = [
                    'code' => 'near_max_bags',
                    'message' => "Trip has {$totalBags} bags — near the zone limit of {$effectiveRule->max_bags} bags ({$this->percent($totalBags, $effectiveRule->max_bags)}% of capacity).",
                    'severity' => 'amber',
                ];
            }

            if ($effectiveRule->max_weight_kg !== null && $totalWeight > $effectiveRule->max_weight_kg) {
                $blockers[] = [
                    'code' => 'exceeds_max_weight',
                    'message' => "Trip weight {$totalWeight} kg exceeds zone limit {$effectiveRule->max_weight_kg} kg. Adjust load or request an override.",
                ];
            } elseif ($effectiveRule->max_weight_kg !== null && $totalWeight >= $effectiveRule->max_weight_kg * 0.85) {
                $warnings[] = [
                    'code' => 'near_max_weight',
                    'message' => "Trip weight {$totalWeight} kg is near the zone limit {$effectiveRule->max_weight_kg} kg.",
                    'severity' => 'amber',
                ];
            }

            if ($effectiveRule->max_stops !== null && $stops > $effectiveRule->max_stops) {
                $blockers[] = [
                    'code' => 'exceeds_max_stops',
                    'message' => "Trip has {$stops} stops but limit is {$effectiveRule->max_stops}. Split the trip or request an override.",
                ];
            }

            if (is_array($effectiveRule->category_allowlist) && $effectiveRule->category_allowlist !== []) {
                $allowed = array_values(array_filter($effectiveRule->category_allowlist, 'is_string'));
                $incompatible = array_values(array_filter(array_keys($categories), fn (string $cat): bool => ! in_array($cat, $allowed, true)));

                if ($incompatible !== []) {
                    $blockers[] = [
                        'code' => 'incompatible_category',
                        'message' => 'Trip mixes categories not allowed together for this zone: '.implode(', ', $incompatible).'. Review vehicle/material requirements.',
                    ];
                }
            }

            // Under minimum is a warning, not a blocker — requires exception workflow.
            if ($effectiveRule->min_bags !== null || $effectiveRule->min_weight_kg !== null) {
                $belowMin = false;
                $minMsgParts = [];

                if ($effectiveRule->min_bags !== null && $totalBags < $effectiveRule->min_bags && $totalBags > 0) {
                    $belowMin = true;
                    $minMsgParts[] = "{$totalBags} bags below minimum {$effectiveRule->min_bags}";
                }

                if ($effectiveRule->min_weight_kg !== null && $totalWeight < $effectiveRule->min_weight_kg && $totalWeight > 0) {
                    $belowMin = true;
                    $minMsgParts[] = "{$totalWeight} kg below minimum {$effectiveRule->min_weight_kg} kg";
                }

                if ($belowMin) {
                    $guidance = is_string($effectiveRule->guidance_text) && $effectiveRule->guidance_text !== '' ? " {$effectiveRule->guidance_text}" : '';
                    $warnings[] = [
                        'code' => 'below_minimum',
                        'message' => 'Trip is '.implode(' and ', $minMsgParts).'.'.$guidance.' An approved exception is required to proceed.',
                        'severity' => 'amber',
                    ];
                }
            }
        }

        // Suggest ordering: proximity-weighted (lat/lng) or created_at fallback.
        $suggestedOrder = $this->suggestStopsForBatch($batch);

        return [
            'ok' => $blockers === [],
            'warnings' => $warnings,
            'blockers' => $blockers,
            'totals' => ['bags' => $totalBags, 'weight_kg' => round($totalWeight, 2), 'stops' => $stops],
            'effective_rule' => $effectiveRule instanceof TextileCapacityRule ? [
                'id' => $effectiveRule->id,
                'max_bags' => $effectiveRule->max_bags,
                'max_weight_kg' => $effectiveRule->max_weight_kg !== null ? (float) $effectiveRule->max_weight_kg : null,
                'max_stops' => $effectiveRule->max_stops,
                'min_bags' => $effectiveRule->min_bags,
                'min_weight_kg' => $effectiveRule->min_weight_kg !== null ? (float) $effectiveRule->min_weight_kg : null,
                'guidance_text' => $effectiveRule->guidance_text,
                'category_allowlist' => $effectiveRule->category_allowlist,
            ] : null,
            'suggested_order' => $suggestedOrder,
        ];
    }

    /**
     * @return list<string>
     */
    public function suggestStopsForBatch(TextileCollectionBatch $batch): array
    {
        $requests = $batch->requests()->orderBy('created_at')->get();

        if ($requests->isEmpty()) {
            return [];
        }

        // Simple heuristic: sort by distance from zone centre, then by estimated bags descending.
        // Staff confirms before applying — this is a suggestion, not an automatic decision.
        $zone = $batch->serviceZone;

        if ($zone instanceof TextileServiceZone && $zone->center_latitude !== null && $zone->center_longitude !== null) {
            $centreLat = (float) $zone->center_latitude;
            $centreLng = (float) $zone->center_longitude;

            $sorted = $requests->sortBy(function (TextileCollectionRequest $req) use ($centreLat, $centreLng): float {
                $lat = $req->latitude !== null ? (float) $req->latitude : $centreLat;
                $lng = $req->longitude !== null ? (float) $req->longitude : $centreLng;

                // Haversine-ish: Euclidean for suggestion only.
                $dist = sqrt((($lat - $centreLat) ** 2) + (($lng - $centreLng) ** 2));

                return $dist;
            })->values();
        } else {
            $sorted = $requests->sortByDesc('estimated_bags')->values();
        }

        /** @var list<string> $ids */
        $ids = $sorted->pluck('id')->all();

        return $ids;
    }

    public function getEffectiveRule(string $serviceZoneId, string $departmentId, mixed $date): ?TextileCapacityRule
    {
        $targetDate = null;

        if ($date instanceof Carbon) {
            $targetDate = $date->toDateString();
        } elseif (is_string($date) && $date !== '') {
            $targetDate = $date;
        }

        $dayOfWeek = null;

        if (is_string($targetDate) && $targetDate !== '') {
            try {
                $dayOfWeek = (int) Carbon::parse($targetDate)->dayOfWeek;
            } catch (\Throwable) {
                $dayOfWeek = null;
            }
        }

        $query = TextileCapacityRule::query()
            ->where('service_zone_id', $serviceZoneId)
            ->where('department_id', $departmentId)
            ->where(function ($q) use ($targetDate): void {
                if (is_string($targetDate) && $targetDate !== '') {
                    $q->where(function ($inner) use ($targetDate): void {
                        $inner->whereNull('effective_from')->orWhere('effective_from', '<=', $targetDate);
                    })->where(function ($inner) use ($targetDate): void {
                        $inner->whereNull('effective_to')->orWhere('effective_to', '>=', $targetDate);
                    });
                }
            });

        if ($dayOfWeek !== null) {
            $query->where(function ($q) use ($dayOfWeek): void {
                $q->whereNull('day_of_week')->orWhere('day_of_week', $dayOfWeek);
            });
        }

        return $query->orderByDesc('updated_at')->first();
    }

    /**
     * Citizen or partner requests an exception for a collection request.
     *
     * @param  array<string, mixed>|null  $payloadSnapshot
     */
    public function requestException(
        TextileCollectionRequest $collection,
        User $actor,
        ?string $reasonCode,
        ?string $reason,
        ?array $payloadSnapshot = null,
        ?string $idempotencyKey = null,
    ): TextileCapacityException {
        if ($collection->status === TextileCollectionRequest::STATUS_PICKED_UP
            || $collection->status === TextileCollectionRequest::STATUS_CANCELLED
            || $collection->status === TextileCollectionRequest::STATUS_REJECTED) {
            throw ApiException::validation('This request can no longer request a capacity exception.');
        }

        $key = is_string($idempotencyKey) && trim($idempotencyKey) !== '' ? trim($idempotencyKey) : (string) Str::uuid();

        // Idempotency: same key returns existing.
        $existing = TextileCapacityException::query()->where('idempotency_key', $key)->first();

        if ($existing instanceof TextileCapacityException) {
            return $existing->load(['collection', 'serviceZone']);
        }

        $deptId = $collection->department_id ?? $collection->serviceZone?->department_id;

        if (! is_string($deptId) || $deptId === '') {
            throw ApiException::validation('Cannot determine partner for this request.');
        }

        $code = is_string($reasonCode) && in_array($reasonCode, TextileCapacityException::VALID_REASON_CODES, true) ? $reasonCode : TextileCapacityException::REASON_BELOW_MINIMUM;

        $exception = DB::transaction(function () use ($collection, $actor, $code, $reason, $payloadSnapshot, $deptId, $key): TextileCapacityException {
            $row = TextileCapacityException::query()->create([
                'collection_request_id' => $collection->id,
                'service_zone_id' => $collection->service_zone_id,
                'department_id' => $deptId,
                'requested_by' => $actor->id,
                'status' => TextileCapacityException::STATUS_PENDING,
                'reason_code' => $code,
                'reason' => is_string($reason) && trim($reason) !== '' ? trim($reason) : null,
                'payload_snapshot' => $payloadSnapshot,
                'idempotency_key' => $key,
            ]);

            $collection->update([
                'capacity_exception_id' => $row->id,
                'capacity_checked_at' => now(),
                'capacity_context' => $payloadSnapshot,
            ]);

            return $row;
        });

        $this->audit($actor, $exception->id, 'textile.capacity_exc_requested', null, [
            'collection_request_id' => $collection->id,
            'reason_code' => $code,
        ]);

        return $exception->load(['collection', 'serviceZone']);
    }

    public function decideException(
        TextileCapacityException $exception,
        User $actor,
        bool $approved,
        ?string $decisionReason = null,
    ): TextileCapacityException {
        if ($exception->status !== TextileCapacityException::STATUS_PENDING) {
            throw ApiException::validation('This exception has already been decided.');
        }

        $newStatus = $approved ? TextileCapacityException::STATUS_APPROVED : TextileCapacityException::STATUS_REJECTED;

        $exception->update([
            'status' => $newStatus,
            'decided_by' => $actor->id,
            'decided_reason' => is_string($decisionReason) && trim($decisionReason) !== '' ? trim($decisionReason) : null,
            'decided_at' => now(),
            'decision_payload' => ['approved' => $approved, 'reason' => $decisionReason],
        ]);

        // If approved, annotate the collection with decision context (human remains owner).
        if ($approved) {
            $collection = $exception->collection;

            if ($collection instanceof TextileCollectionRequest) {
                $collection->update([
                    'capacity_context' => array_merge(
                        is_array($collection->capacity_context) ? $collection->capacity_context : [],
                        ['exception_approved_at' => now()->toIso8601String(), 'exception_id' => $exception->id],
                    ),
                ]);
            }
        }

        $this->audit($actor, $exception->id, $approved ? 'textile.capacity_exc_approved' : 'textile.capacity_exc_rejected', ['status' => TextileCapacityException::STATUS_PENDING], [
            'status' => $newStatus,
            'decided_reason' => $decisionReason,
        ]);

        return $exception->refresh()->load(['collection', 'serviceZone']);
    }

    /**
     * @return array{min_bags: int|null, min_weight_kg: float|null, guidance_text: string|null, effective_rule: TextileCapacityRule|null}
     */
    public function getMinimumForZone(string $serviceZoneId, string $departmentId, ?string $date = null): array
    {
        $rule = $this->getEffectiveRule($serviceZoneId, $departmentId, $date ?? now()->toDateString());

        if (! $rule instanceof TextileCapacityRule) {
            return ['min_bags' => null, 'min_weight_kg' => null, 'guidance_text' => null, 'effective_rule' => null];
        }

        return [
            'min_bags' => $rule->min_bags,
            'min_weight_kg' => $rule->min_weight_kg !== null ? (float) $rule->min_weight_kg : null,
            'guidance_text' => $rule->guidance_text,
            'effective_rule' => $rule,
        ];
    }

    private function percent(int $value, int $max): int
    {
        if ($max <= 0) {
            return 0;
        }

        return (int) round(($value / $max) * 100);
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
            'entity' => 'textile_capacity',
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
