<?php

declare(strict_types=1);

namespace App\Modules\Departments\Jobs;

use App\Modules\Departments\Services\ProofVerificationService;
use App\Modules\Media\Models\Media;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

/** Runs the slow AI proof comparison after the upload response is returned. */
final class VerifyProofJob implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [15, 60, 180];

    public int $timeout = 120;

    public function __construct(public readonly string $mediaId) {}

    public function handle(ProofVerificationService $verification): void
    {
        $media = Media::query()->find($this->mediaId);

        if ($media === null || $media->role !== 'proof' || $media->is_replaced) {
            Log::info('department.proof_verification.skipped', [
                'media_id' => $this->mediaId,
                'reason' => $media === null ? 'missing_media' : 'inactive_proof',
            ]);

            return;
        }

        try {
            $result = $verification->verify($media);

            Log::info('department.proof_verification.completed', [
                'media_id' => $this->mediaId,
                'verification_id' => $result->id,
                'status' => $result->status,
            ]);
        } catch (Throwable $exception) {
            Log::warning('department.proof_verification.retrying', [
                'media_id' => $this->mediaId,
                'attempt' => $this->attempts(),
                'error' => $exception->getMessage(),
            ]);

            throw $exception;
        }
    }

    public function failed(?Throwable $exception): void
    {
        Log::error('department.proof_verification.failed', [
            'media_id' => $this->mediaId,
            'tries' => $this->tries,
            'error' => $exception?->getMessage(),
        ]);
    }

    public function uniqueId(): string
    {
        return $this->mediaId;
    }

    public function uniqueFor(): int
    {
        return 900;
    }

    /** @return list<string> */
    public function tags(): array
    {
        return ['departments', 'proof-verification', 'media:'.$this->mediaId];
    }
}
