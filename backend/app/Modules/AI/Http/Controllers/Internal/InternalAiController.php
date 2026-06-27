<?php

declare(strict_types=1);

namespace App\Modules\AI\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Modules\AI\Http\Resources\AiJobResource;
use App\Modules\AI\Http\Resources\AiResultResource;
use App\Modules\AI\Jobs\AiPipelineOrchestrator;
use App\Modules\AI\Models\AiJob;
use App\Modules\AI\Models\AiResult;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Internal AI controller — backs the `/api/v1/internal/ai/*`
 * endpoints. These are the platform-internal surface used by
 * the worker, by the Citizen PWA's retry button, and by the
 * M9 Notifications module to re-trigger the pipeline for
 * stuck reports. The `system` Spatie role is required.
 */
class InternalAiController extends Controller
{
    /**
     * POST /api/v1/internal/ai/process
     * Enqueue a pipeline run for a report. Returns 202 with the
     * dispatched job id.
     */
    public function process(Request $request, string $reportId): JsonResponse
    {
        $job = AiPipelineOrchestrator::dispatch($reportId);

        return response()->json([
            'status' => 'queued',
            'report_id' => $reportId,
            'job_id' => null, // The orchestrator creates its own row on first handle().
            'queued_at' => now()->toIso8601String(),
        ], 202);
    }

    /**
     * GET /api/v1/internal/ai/job/{id}
     * Returns job status; 404 if missing.
     */
    public function job(string $id): AiJobResource|JsonResponse
    {
        $job = AiJob::query()->find($id);

        if ($job === null) {
            return response()->json(['message' => 'job_not_found'], 404);
        }

        return new AiJobResource($job);
    }

    /**
     * GET /api/v1/internal/ai/job/{id}/result
     * Returns the result and labels; 404 if not yet produced.
     */
    public function result(string $id): AiResultResource|JsonResponse
    {
        $result = AiResult::query()
            ->with('labels')
            ->where('job_id', $id)
            ->first();

        if ($result === null) {
            return response()->json(['message' => 'result_not_ready'], 404);
        }

        return new AiResultResource($result);
    }
}
