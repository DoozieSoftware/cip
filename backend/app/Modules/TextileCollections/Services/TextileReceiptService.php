<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Services;

use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\TextileCollections\Events\TextileDropoffReceiptRecorded;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\TextileCollections\Models\TextileDropoffReceipt;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;

final class TextileReceiptService
{
    /**
     * Record receipt for a dropoff request. Idempotent via UNIQUE collection_request_id + idempotency_key.
     */
    public function record(
        TextileCollectionRequest $collection,
        User $actor,
        ?int $actualBags,
        ?float $actualWeightKg,
        ?string $proofMediaId,
        ?string $exceptionCode,
        ?string $exceptionReason,
        ?string $idempotencyKey = null,
    ): TextileDropoffReceipt {
        if ($collection->collection_method !== 'dropoff') {
            throw ApiException::validation('Only drop-off requests can be received.');
        }

        return DB::transaction(function () use ($collection, $actor, $actualBags, $actualWeightKg, $proofMediaId, $exceptionCode, $exceptionReason, $idempotencyKey): TextileDropoffReceipt {
            // Lock row
            $locked = TextileCollectionRequest::query()->whereKey($collection->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== TextileCollectionRequest::STATUS_DROPOFF_AWAITING_DROP) {
                throw ApiException::validation('This booking cannot be received at this stage.');
            }

            // Idempotency: if receipt already exists return it
            $existing = TextileDropoffReceipt::query()->where('collection_request_id', $collection->id)->first();
            if ($existing !== null) {
                return $existing;
            }

            $receipt = TextileDropoffReceipt::query()->create([
                'collection_request_id' => $collection->id,
                'received_by' => $actor->id,
                'service_zone_id' => $collection->service_zone_id,
                'received_at' => now(),
                'actual_bags' => $actualBags,
                'actual_weight_kg' => $actualWeightKg,
                'proof_media_id' => $proofMediaId,
                'exception_code' => $exceptionCode,
                'exception_reason' => $exceptionReason,
                'idempotency_key' => $idempotencyKey,
            ]);

            // Guarded status update
            $affected = TextileCollectionRequest::query()
                ->whereKey($collection->id)
                ->where('status', TextileCollectionRequest::STATUS_DROPOFF_AWAITING_DROP)
                ->update([
                    'status' => TextileCollectionRequest::STATUS_RECEIVED_AT_CENTRE,
                    'actual_bags' => $actualBags,
                    'actual_weight_kg' => $actualWeightKg,
                    'receipt_id' => $receipt->id,
                    'updated_at' => now(),
                ]);

            if ($affected === 0) {
                throw ApiException::validation('Receipt conflict: booking already received.');
            }

            $this->audit($actor, $receipt->id, 'textile.receipt_record', null, ['receipt_id' => $receipt->id, 'status' => TextileCollectionRequest::STATUS_RECEIVED_AT_CENTRE]);

            TextileDropoffReceiptRecorded::dispatch($receipt);

            return $receipt;
        });
    }

    private function audit(User $actor, string $entityId, string $action, ?array $before, array $after): void
    {
        $requestId = request()->attributes->get('trace_id');
        AuditLog::query()->create([
            'user_id' => $actor->id,
            'entity' => 'textile_dropoff_receipt',
            'entity_id' => $entityId,
            'action' => $action,
            'before' => $before,
            'after' => $after,
            'ip' => request()->ip(),
            'device_fingerprint' => null,
            'request_id' => is_string($requestId) ? $requestId : null,
            'created_at' => now(),
        ]);
    }
}
