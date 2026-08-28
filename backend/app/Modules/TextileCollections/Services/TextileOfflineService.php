<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Services;

use App\Modules\Media\Models\Media;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\TextileCollections\Models\TextileOfflineSubmission;
use App\Modules\Users\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Throwable;

final class TextileOfflineService
{
    public function __construct(
        private readonly TextileCollectionOperationsService $operations,
        private readonly TextileCollectionMediaService $mediaService,
    ) {}

    /**
     * Queue or complete an offline outcome atomically and idempotently.
     *
     * Idempotency is enforced by the UNIQUE idempotency_key. A retry with
     * the same key returns the existing submission unchanged — no duplicate
     * outcome or proof is created. The proof file, if supplied, is stored
     * via the same media pipeline (checksum, chain-of-custody) so server-side
     * validation is never bypassed.
     */
    public function submit(
        TextileCollectionRequest $collection,
        User $actor,
        string $idempotencyKey,
        string $outcome,
        ?int $actualBags,
        ?float $actualWeightKg,
        ?string $reason,
        ?string $existingProofMediaId,
        ?UploadedFile $proofFile,
    ): TextileOfflineSubmission {
        $idempotencyKey = trim($idempotencyKey);

        if ($idempotencyKey === '' || strlen($idempotencyKey) > 128) {
            throw ApiException::validation('Idempotency-Key header is required (1-128 chars).');
        }

        // Fast-path: existing submission for this idempotency key → idempotent return.
        $existing = TextileOfflineSubmission::query()
            ->where('idempotency_key', $idempotencyKey)
            ->first();

        if ($existing !== null) {
            // Ensure the caller owns the original submission (tied to authenticated user/session per D-08).
            // A different user retrying the same key is forbidden — keys are per-user.
            if ((string) $existing->submitted_by !== (string) $actor->id) {
                throw ApiException::forbidden('This idempotency key belongs to another user.');
            }

            // If the existing submission was for a different collection, treat as conflict.
            if ((string) $existing->collection_request_id !== (string) $collection->id) {
                throw ApiException::validation('Idempotency key already used for a different collection request.');
            }

            return $existing;
        }

        // Validate outcome value early.
        if (! in_array($outcome, ['collected', 'missed'], true)) {
            throw ApiException::validation('Offline outcome must be collected or missed.');
        }

        // For offline queue we only allow premises lane; dropoff uses receipt flow.
        if ($collection->collection_method === 'dropoff') {
            throw ApiException::validation('Use receipt for drop-off collections; offline queue is for doorstep pickups.');
        }

        try {
            return DB::transaction(function () use (
                $collection,
                $actor,
                $idempotencyKey,
                $outcome,
                $actualBags,
                $actualWeightKg,
                $reason,
                $existingProofMediaId,
                $proofFile,
            ): TextileOfflineSubmission {
                // Re-lock collection row for concurrency (mirrors scheduleBatch pattern).
                $locked = TextileCollectionRequest::query()
                    ->whereKey($collection->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                // Create pending submission row.
                $submission = TextileOfflineSubmission::query()->create([
                    'collection_request_id' => $locked->id,
                    'submitted_by' => $actor->id,
                    'service_zone_id' => $locked->service_zone_id,
                    'idempotency_key' => $idempotencyKey,
                    'outcome' => $outcome,
                    'actual_bags' => $actualBags,
                    'actual_weight_kg' => $actualWeightKg,
                    'reason' => $reason,
                    'proof_media_id' => $existingProofMediaId,
                    'status' => TextileOfflineSubmission::STATUS_PENDING,
                    'retry_count' => 0,
                ]);

                $this->audit($actor, $submission->id, 'textile.offline_queue', null, [
                    'collection_request_id' => $locked->id,
                    'outcome' => $outcome,
                    'idempotency_key' => $idempotencyKey,
                    'status' => TextileOfflineSubmission::STATUS_PENDING,
                ]);

                // Attempt to complete synchronously; on failure mark as failed but do not discard.
                try {
                    $proofMediaId = $existingProofMediaId;

                    // If a proof file is supplied with the offline payload, store it first.
                    if ($proofFile !== null) {
                        $media = $this->mediaService->uploadProof($locked->id, $proofFile, (string) $actor->id);
                        $proofMediaId = $media->id;
                        $submission->update(['proof_media_id' => $proofMediaId]);
                    }

                    // If collected, ensure at least one proof exists (server-side guard — never bypassed).
                    if ($outcome === 'collected') {
                        $hasProof = $proofMediaId !== null && $proofMediaId !== '';

                        if (! $hasProof) {
                            $hasProof = Media::query()
                                ->where('textile_collection_id', $locked->id)
                                ->where('role', 'proof')
                                ->where('is_replaced', false)
                                ->exists();
                        }

                        if (! $hasProof) {
                            throw new ApiException('PROOF_PHOTO_REQUIRED', 'A proof photo is required to record a collection.', 422);
                        }
                    }

                    // Delegate to the authoritative outcome service. This respects
                    // status guards, proof checks, and audit logging.
                    $this->operations->recordOutcome(
                        collection: $locked->refresh(),
                        outcome: $outcome,
                        actualBags: $actualBags,
                        actualWeightKg: $actualWeightKg,
                        reason: $reason,
                        actor: $actor,
                    );

                    $submission->update([
                        'status' => TextileOfflineSubmission::STATUS_COMPLETED,
                        'completed_at' => now(),
                        'error_code' => null,
                        'error_message' => null,
                    ]);

                    $this->audit($actor, $submission->id, 'textile.offline_complete', ['status' => TextileOfflineSubmission::STATUS_PENDING], ['status' => TextileOfflineSubmission::STATUS_COMPLETED]);
                } catch (Throwable $e) {
                    $alreadyTerminal = in_array($locked->refresh()->status, [
                        TextileCollectionRequest::STATUS_PICKED_UP,
                        TextileCollectionRequest::STATUS_MISSED,
                    ], true);

                    // If the collection is already in the desired terminal state due to a prior
                    // idempotent apply, treat as completed even if recordOutcome threw guard error.
                    $desiredStatus = $outcome === 'collected' ? TextileCollectionRequest::STATUS_PICKED_UP : TextileCollectionRequest::STATUS_MISSED;

                    if ($alreadyTerminal && $locked->refresh()->status === $desiredStatus) {
                        $submission->update([
                            'status' => TextileOfflineSubmission::STATUS_COMPLETED,
                            'completed_at' => now(),
                            'error_code' => null,
                            'error_message' => null,
                        ]);
                    } else {
                        $codeStr = $e instanceof ApiException ? ($e->errorCode !== '' ? $e->errorCode : 'VALIDATION_FAILED') : 'SERVER_ERROR';
                        $msg = $e->getMessage();

                        $submission->update([
                            'status' => TextileOfflineSubmission::STATUS_FAILED,
                            'error_code' => substr((string) $codeStr, 0, 64),
                            'error_message' => substr($msg, 0, 2000),
                            'retry_count' => $submission->retry_count + 1,
                        ]);

                        $this->audit($actor, $submission->id, 'textile.offline_failed', ['status' => TextileOfflineSubmission::STATUS_PENDING], ['status' => TextileOfflineSubmission::STATUS_FAILED, 'error_code' => $codeStr]);

                        // For validation errors we keep the submission as FAILED and re-throw so
                        // the caller receives the actionable 422, but the failed row remains
                        // visible in the recovery view (never silently discarded).
                        if ($e instanceof ApiException && $e->httpStatus === 422) {
                            throw $e;
                        }

                        // For proof/media errors, also re-throw as 422.
                        if ($e instanceof ApiException) {
                            throw $e;
                        }

                        throw $e;
                    }
                }

                return $submission->refresh();
            });
        } catch (Throwable $e) {
            // UNIQUE idempotency_key race: another concurrent submit won the insert.
            if ($e instanceof QueryException && str_contains($e->getMessage(), 'idempotency_key')) {
                $winner = TextileOfflineSubmission::query()->where('idempotency_key', $idempotencyKey)->first();

                if ($winner !== null) {
                    if ((string) $winner->submitted_by !== (string) $actor->id) {
                        throw ApiException::forbidden('This idempotency key belongs to another user.');
                    }

                    return $winner;
                }
            }

            throw $e;
        }
    }

    /**
     * List submissions for the recovery/pending view.
     *
     * Scoped to the actor's partner department(s) so a partner cannot see
     * another partner's queued evidence.
     *
     * @return LengthAwarePaginator<TextileOfflineSubmission>
     */
    public function listForActor(User $actor, ?string $status, ?string $serviceZoneId, int $perPage = 25): LengthAwarePaginator
    {
        $query = TextileOfflineSubmission::query()
            ->with(['collectionRequest', 'proofMedia'])
            ->where('submitted_by', $actor->id)
            ->orderByDesc('created_at');

        if ($status !== null && in_array($status, [TextileOfflineSubmission::STATUS_PENDING, TextileOfflineSubmission::STATUS_COMPLETED, TextileOfflineSubmission::STATUS_FAILED], true)) {
            $query->where('status', $status);
        }

        if ($serviceZoneId !== null && $serviceZoneId !== '') {
            $query->where('service_zone_id', $serviceZoneId);
        }

        return $query->paginate(max(1, min(100, $perPage)));
    }

    /**
     * Retry a failed or pending submission.
     */
    public function retry(TextileOfflineSubmission $submission, User $actor): TextileOfflineSubmission
    {
        if ((string) $submission->submitted_by !== (string) $actor->id) {
            throw ApiException::forbidden('You cannot retry a submission owned by another user.');
        }

        if ($submission->status === TextileOfflineSubmission::STATUS_COMPLETED) {
            return $submission;
        }

        $collection = TextileCollectionRequest::query()->findOrFail($submission->collection_request_id);

        return DB::transaction(function () use ($submission, $actor, $collection): TextileOfflineSubmission {
            // Lock submission row to prevent concurrent retry.
            $locked = TextileOfflineSubmission::query()
                ->whereKey($submission->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($locked->status === TextileOfflineSubmission::STATUS_COMPLETED) {
                return $locked;
            }

            $locked->increment('retry_count');

            try {
                // Re-check proof requirement server-side.
                if ($locked->outcome === 'collected') {
                    $hasProof = $locked->proof_media_id !== null;

                    if (! $hasProof) {
                        $hasProof = Media::query()
                            ->where('textile_collection_id', $collection->id)
                            ->where('role', 'proof')
                            ->where('is_replaced', false)
                            ->exists();
                    }

                    if (! $hasProof) {
                        throw new ApiException('PROOF_PHOTO_REQUIRED', 'A proof photo is required to record a collection.', 422);
                    }
                }

                $this->operations->recordOutcome(
                    collection: $collection->refresh(),
                    outcome: $locked->outcome,
                    actualBags: $locked->actual_bags,
                    actualWeightKg: $locked->actual_weight_kg !== null ? (float) $locked->actual_weight_kg : null,
                    reason: $locked->reason,
                    actor: $actor,
                );

                $locked->update([
                    'status' => TextileOfflineSubmission::STATUS_COMPLETED,
                    'completed_at' => now(),
                    'error_code' => null,
                    'error_message' => null,
                ]);

                $this->audit($actor, $locked->id, 'textile.offline_retry_success', ['status' => TextileOfflineSubmission::STATUS_FAILED], ['status' => TextileOfflineSubmission::STATUS_COMPLETED]);
            } catch (Throwable $e) {
                $codeStr = $e instanceof ApiException ? ($e->errorCode !== '' ? $e->errorCode : 'VALIDATION_FAILED') : 'SERVER_ERROR';

                $locked->update([
                    'status' => TextileOfflineSubmission::STATUS_FAILED,
                    'error_code' => substr((string) $codeStr, 0, 64),
                    'error_message' => substr($e->getMessage(), 0, 2000),
                ]);

                $this->audit($actor, $locked->id, 'textile.offline_retry_failed', ['status' => TextileOfflineSubmission::STATUS_FAILED], ['error_code' => $codeStr]);

                if ($e instanceof ApiException) {
                    throw $e;
                }

                throw $e;
            }

            return $locked->refresh();
        });
    }

    /** @param array<string,mixed>|null $before @param array<string,mixed> $after */
    private function audit(User $actor, string $entityId, string $action, ?array $before, array $after): void
    {
        $requestId = request()->attributes->get('trace_id');

        AuditLog::query()->create([
            'user_id' => $actor->id,
            'entity' => 'textile_offline_submission',
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
