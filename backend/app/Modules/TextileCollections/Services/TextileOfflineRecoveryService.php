<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Services;

use App\Modules\Security\Models\AuditLog;
use App\Modules\TextileCollections\Models\TextileOfflineRecoveryItem;
use App\Modules\Users\Models\User;

final class TextileOfflineRecoveryService
{
    /**
     * @param  array<string, mixed>|null  $payload
     */
    public function report(
        string $collectionId,
        User $reporter,
        ?string $idempotencyKey,
        ?string $failureReason,
        ?array $payload,
    ): TextileOfflineRecoveryItem {
        $item = TextileOfflineRecoveryItem::query()->create([
            'collection_request_id' => $collectionId,
            'reported_by' => $reporter->id,
            'idempotency_key' => $idempotencyKey,
            'failure_reason' => $failureReason,
            'payload_snapshot' => $payload,
            'status' => TextileOfflineRecoveryItem::STATUS_PENDING,
        ]);

        AuditLog::query()->create([
            'user_id' => $reporter->id,
            'entity' => 'textile_offline_recovery',
            'entity_id' => $item->id,
            'action' => 'textile.offline_failure_reported',
            'before' => null,
            'after' => [
                'collection_request_id' => $collectionId,
                'idempotency_key' => $idempotencyKey,
                'failure_reason' => $failureReason,
            ],
            'ip' => request()->ip(),
            'device_fingerprint' => null,
            'request_id' => request()->attributes->get('trace_id'),
            'created_at' => now(),
        ]);

        return $item;
    }

    public function resolve(TextileOfflineRecoveryItem $item, User $actor): TextileOfflineRecoveryItem
    {
        $item->update([
            'status' => TextileOfflineRecoveryItem::STATUS_RESOLVED,
            'resolved_at' => now(),
            'resolved_by' => $actor->id,
        ]);

        AuditLog::query()->create([
            'user_id' => $actor->id,
            'entity' => 'textile_offline_recovery',
            'entity_id' => $item->id,
            'action' => 'textile.offline_failure_resolved',
            'before' => ['status' => TextileOfflineRecoveryItem::STATUS_PENDING],
            'after' => ['status' => TextileOfflineRecoveryItem::STATUS_RESOLVED],
            'ip' => request()->ip(),
            'device_fingerprint' => null,
            'request_id' => request()->attributes->get('trace_id'),
            'created_at' => now(),
        ]);

        return $item->refresh();
    }
}
