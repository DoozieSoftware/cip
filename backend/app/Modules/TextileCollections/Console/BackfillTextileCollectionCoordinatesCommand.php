<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Console;

use App\Modules\Public\Services\ReverseGeocodeService;
use App\Modules\Security\Models\AuditLog;
use App\Modules\TextileCollections\Models\TextileCollectionBatch;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\TextileCollections\Services\TextileRouteOptimizer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

final class BackfillTextileCollectionCoordinatesCommand extends Command
{
    protected $signature = 'textile:backfill-coordinates
        {--limit=500 : Maximum address-only collections to inspect}
        {--pause-ms=1100 : Delay between provider calls}
        {--dry-run : Report candidates without changing data}';

    protected $description = 'Geocode address-only premises collections and optimize affected trip order';

    public function handle(ReverseGeocodeService $geocoder): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $pauseMilliseconds = max(0, (int) $this->option('pause-ms'));
        $dryRun = (bool) $this->option('dry-run');
        $collections = TextileCollectionRequest::query()
            ->where('collection_method', 'premises')
            ->whereNull('latitude')
            ->whereNull('longitude')
            ->whereNotNull('pickup_address')
            ->orderBy('created_at')
            ->limit($limit)
            ->get();

        $this->info("Found {$collections->count()} address-only collection(s).");

        if ($dryRun || $collections->isEmpty()) {
            return self::SUCCESS;
        }

        $updated = 0;
        $failed = 0;
        $affectedBatchIds = [];

        foreach ($collections as $index => $collection) {
            $result = $geocoder->search((string) $collection->pickup_address);

            if ($result['geocoded'] && $result['latitude'] !== null && $result['longitude'] !== null) {
                // Recheck both null guards in the UPDATE so a concurrently saved
                // GPS pin can never be overwritten by this maintenance task.
                $changed = TextileCollectionRequest::query()
                    ->whereKey($collection->id)
                    ->whereNull('latitude')
                    ->whereNull('longitude')
                    ->update([
                        'latitude' => $result['latitude'],
                        'longitude' => $result['longitude'],
                        'updated_at' => now(),
                    ]);

                if ($changed === 1) {
                    $updated++;

                    if ($collection->batch_id !== null) {
                        $affectedBatchIds[(string) $collection->batch_id] = true;
                    }
                }
            } else {
                $failed++;
                $this->warn("No map match for collection {$collection->id}.");
            }

            if ($pauseMilliseconds > 0 && $index < $collections->count() - 1) {
                usleep($pauseMilliseconds * 1000);
            }
        }

        $optimized = $this->optimizeAffectedBatches(array_keys($affectedBatchIds));
        $this->info("Updated {$updated}; unmatched {$failed}; optimized {$optimized} trip(s).");

        return self::SUCCESS;
    }

    /** @param list<string> $batchIds */
    private function optimizeAffectedBatches(array $batchIds): int
    {
        $count = 0;
        $batches = TextileCollectionBatch::query()
            ->with(['serviceZone', 'requests'])
            ->whereIn('id', $batchIds)
            ->whereIn('status', [TextileCollectionBatch::STATUS_PLANNED, TextileCollectionBatch::STATUS_ASSIGNED])
            ->get();

        foreach ($batches as $batch) {
            $zone = $batch->serviceZone;
            $requests = $batch->requests
                ->sortBy(fn (TextileCollectionRequest $request): array => [
                    $request->stop_order ?? PHP_INT_MAX,
                    $request->created_at?->getTimestamp() ?? 0,
                ])
                ->values();
            $orderedIds = TextileRouteOptimizer::optimize(
                array_values($requests->map(fn (TextileCollectionRequest $request): array => [
                    'id' => (string) $request->id,
                    'latitude' => $request->latitude,
                    'longitude' => $request->longitude,
                ])->all()),
                $zone?->center_latitude,
                $zone?->center_longitude,
            );

            DB::transaction(function () use ($batch, $orderedIds): void {
                foreach ($orderedIds as $index => $id) {
                    TextileCollectionRequest::query()
                        ->whereKey($id)
                        ->where('batch_id', $batch->id)
                        ->update(['stop_order' => $index + 1]);
                }

                AuditLog::query()->create([
                    'user_id' => null,
                    'entity' => 'textile_collection_batch',
                    'entity_id' => $batch->id,
                    'action' => 'textile.route_backfill_optimize',
                    'before' => null,
                    'after' => ['order' => $orderedIds],
                    'ip' => null,
                    'request_id' => null,
                    'created_at' => now(),
                ]);
            });
            $count++;
        }

        return $count;
    }
}
