<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Resources;

use App\Modules\Media\Models\Media;
use App\Modules\Media\Support\MediaUrl;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @property-read TextileCollectionRequest $resource */
final class TextileCollectionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $zone = $this->resource->relationLoaded('serviceZone') ? $this->resource->serviceZone : null;
        $batch = $this->resource->relationLoaded('batch') ? $this->resource->batch : null;
        $department = $this->resource->relationLoaded('department') ? $this->resource->department : null;

        return [
            'id' => $this->resource->id,
            'reference' => $this->resource->reference,
            'title' => $this->resource->title,
            'notes' => $this->resource->notes,
            'status' => $this->resource->status,
            'category' => $this->resource->category,
            'requester_type' => $this->resource->requester_type,
            'requester_name' => $this->resource->requester_name,
            'rwa_name' => $this->resource->rwa_name,
            'contact_email' => $this->resource->contact_email,
            'contact_phone' => $this->resource->contact_phone,
            'pickup_address' => $this->resource->pickup_address,
            'latitude' => $this->resource->latitude,
            'longitude' => $this->resource->longitude,
            'collection_method' => $this->resource->collection_method,
            'estimated_bags' => $this->resource->estimated_bags,
            'estimated_weight_kg' => $this->resource->estimated_weight_kg,
            'actual_bags' => $this->resource->actual_bags,
            'actual_weight_kg' => $this->resource->actual_weight_kg,
            'scheduled_date' => $this->resource->scheduled_date?->toDateString(),
            'scheduled_window_start' => $this->resource->scheduled_window_start,
            'scheduled_window_end' => $this->resource->scheduled_window_end,
            'readiness_instructions' => $this->resource->readiness_instructions,
            'rejection_reason' => $this->resource->rejection_reason,
            'cancellation_reason' => $this->resource->cancellation_reason,
            'missed_pickup_reason' => $this->resource->missed_pickup_reason,
            'picked_up_at' => $this->resource->picked_up_at?->toIso8601String(),
            'submitted_at' => $this->resource->submitted_at?->toIso8601String(),
            'dropoff_confirmed_at' => $this->resource->dropoff_confirmed_at?->toIso8601String(),
            'dropoff_valid_until' => $this->resource->dropoff_valid_until?->toDateString(),
            'rescheduled_at' => $this->resource->rescheduled_at?->toIso8601String(),
            'reminder_sent_at' => $this->resource->reminder_sent_at?->toIso8601String(),
            'reschedule_count' => $this->resource->reschedule_count,
            'previous_scheduled_date' => $this->resource->previous_scheduled_date?->toDateString(),
            'previous_window_start' => $this->resource->previous_window_start,
            'previous_window_end' => $this->resource->previous_window_end,
            'previous_batch_id' => $this->resource->previous_batch_id,
            'next_step' => $this->nextStep(),
            'service_zone' => $zone === null ? null : [
                'id' => $zone->id,
                'code' => $zone->code,
                'name' => $zone->name,
                'dropoff_name' => $zone->dropoff_name,
                'dropoff_address' => $zone->dropoff_address,
            ],
            'batch' => $batch === null ? null : [
                'id' => $batch->id,
                'reference' => $batch->reference,
                'collection_date' => $batch->collection_date->toDateString(),
                'window_start' => $batch->window_start,
                'window_end' => $batch->window_end,
                'status' => $batch->status,
                'trip_reference' => $batch->trip_reference,
            ],
            'partner' => $department === null ? null : [
                'id' => $department->id,
                'name' => $department->name,
            ],
            'photos' => $this->photosArray(),
        ];
    }

    private function nextStep(): ?string
    {
        return match ($this->resource->status) {
            'dropoff_awaiting_drop' => 'Drop off at centre',
            'pending_review' => 'Awaiting review',
            default => null,
        };
    }

    /** @return list<array{id: string, role: string, url: string}> */
    private function photosArray(): array
    {
        if (! $this->resource->relationLoaded('photos')) {
            return [];
        }

        /** @var Collection<int, Media> $photos */
        $photos = $this->resource->photos;

        /** @var MediaUrl $mediaUrl */
        $mediaUrl = app(MediaUrl::class);

        /** @var list<array{id: string, role: string, url: string}> */
        return $photos
            ->filter(fn (Media $m): bool => ! $m->is_replaced)
            ->values()
            ->map(fn (Media $m) => [
                'id' => $m->id,
                'role' => $m->role,
                'url' => $mediaUrl->temporary($m),
            ])
            ->all();
    }
}
