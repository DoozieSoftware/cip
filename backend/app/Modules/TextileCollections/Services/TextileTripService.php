<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Services;

use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\TextileCollections\Events\TextileTripAssigned;
use App\Modules\TextileCollections\Events\TextileTripStarted;
use App\Modules\TextileCollections\Models\TextileCollectionBatch;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;

final class TextileTripService
{
    public function assign(TextileCollectionBatch $batch, User $actor, ?string $teamId, ?string $userId, ?string $vehicleLabel, ?string $reason): TextileCollectionBatch
    {
        if (! in_array($batch->status, [TextileCollectionBatch::STATUS_PLANNED, TextileCollectionBatch::STATUS_ASSIGNED], true)) {
            throw ApiException::validation('Trip can only be assigned in planned/assigned status.');
        }

        $before = ['status' => $batch->status, 'assigned_user_id' => $batch->assigned_user_id];
        $expectedVersion = $batch->row_version;

        $affected = TextileCollectionBatch::query()
            ->whereKey($batch->id)
            ->where('row_version', $expectedVersion)
            ->update([
                'assigned_team_id' => $teamId,
                'assigned_user_id' => $userId,
                'vehicle_label' => $vehicleLabel,
                'assignment_reason' => $reason,
                'assigned_by' => $actor->id,
                'assigned_at' => now(),
                'status' => TextileCollectionBatch::STATUS_ASSIGNED,
                'row_version' => $expectedVersion + 1,
                'updated_at' => now(),
            ]);

        if ($affected === 0) {
            throw ApiException::validation('Concurrent assignment conflict; please retry.');
        }

        $this->audit($actor, $batch->id, 'textile.trip_assign', $before, ['status' => TextileCollectionBatch::STATUS_ASSIGNED]);

        $refreshed = $batch->refresh();
        TextileTripAssigned::dispatch($refreshed);

        return $refreshed;
    }

    public function start(TextileCollectionBatch $batch, User $actor): TextileCollectionBatch
    {
        if ($batch->status !== TextileCollectionBatch::STATUS_ASSIGNED) {
            throw ApiException::validation('Trip can only be started from assigned status.');
        }

        $batch->update(['status' => TextileCollectionBatch::STATUS_IN_PROGRESS, 'started_at' => now(), 'row_version' => $batch->row_version + 1]);
        $this->audit($actor, $batch->id, 'textile.trip_start', ['status' => TextileCollectionBatch::STATUS_ASSIGNED], ['status' => TextileCollectionBatch::STATUS_IN_PROGRESS]);
        TextileTripStarted::dispatch($batch->refresh());

        return $batch->refresh();
    }

    public function complete(TextileCollectionBatch $batch, User $actor): TextileCollectionBatch
    {
        if ($batch->status !== TextileCollectionBatch::STATUS_IN_PROGRESS) {
            throw ApiException::validation('Trip can only be completed from in_progress.');
        }

        $batch->update(['status' => TextileCollectionBatch::STATUS_COMPLETED, 'completed_at' => now(), 'row_version' => $batch->row_version + 1]);
        $this->audit($actor, $batch->id, 'textile.trip_complete', ['status' => TextileCollectionBatch::STATUS_IN_PROGRESS], ['status' => TextileCollectionBatch::STATUS_COMPLETED]);

        return $batch->refresh();
    }

    public function reorder(TextileCollectionBatch $batch, User $actor, array $orderedIds): TextileCollectionBatch
    {
        if ($batch->status === TextileCollectionBatch::STATUS_IN_PROGRESS || $batch->status === TextileCollectionBatch::STATUS_COMPLETED) {
            throw ApiException::validation('Cannot reorder after trip has started.');
        }

        DB::transaction(function () use ($batch, $orderedIds): void {
            foreach ($orderedIds as $idx => $id) {
                DB::table('textile_collection_requests')->where('id', $id)->where('batch_id', $batch->id)->update(['stop_order' => $idx + 1]);
            }
        });

        $this->audit($actor, $batch->id, 'textile.stop_reorder', null, ['order' => $orderedIds]);

        return $batch->refresh();
    }

    private function audit(User $actor, string $entityId, string $action, ?array $before, array $after): void
    {
        $requestId = request()->attributes->get('trace_id');
        AuditLog::query()->create([
            'user_id' => $actor->id,
            'entity' => 'textile_collection_batch',
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
