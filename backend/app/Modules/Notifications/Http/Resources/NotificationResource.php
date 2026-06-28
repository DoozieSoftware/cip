<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources;

use App\Modules\Notifications\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Citizen-facing JSON view of a `notifications` row.
 *
 * The resource intentionally omits internal fields
 * (template_id, retry_count, last_error) and exposes
 * only what the inbox UI needs to render the row and
 * let the citizen act on it (mark as read).
 */
class NotificationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Notification $n */
        $n = $this->resource;

        $rendered = (array) ($n->payload['rendered'] ?? []);

        return [
            'id' => (string) $n->id,
            'type' => (string) $n->type,
            'channel' => (string) $n->channel,
            'subject' => (string) ($rendered['subject'] ?? ''),
            'body' => (string) ($rendered['body'] ?? ''),
            'status' => (string) $n->status,
            'read_at' => $n->read_at?->toIso8601String(),
            'created_at' => $n->created_at?->toIso8601String(),
            'metadata' => $this->publicMetadata($n),
        ];
    }

    /**
     * The payload fields that are safe to surface to a citizen.
     *
     * @return array<string, mixed>
     */
    private function publicMetadata(Notification $n): array
    {
        $payload = (array) $n->payload;
        $variables = (array) ($payload['variables'] ?? []);

        $allowed = ['report_id', 'tracking_number', 'title', 'from_status', 'to_status', 'ai_label', 'category', 'severity'];

        return array_filter(
            $variables,
            static fn (string $k): bool => in_array($k, $allowed, true),
            ARRAY_FILTER_USE_KEY,
        );
    }
}
