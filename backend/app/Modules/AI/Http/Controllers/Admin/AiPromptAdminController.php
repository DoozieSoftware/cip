<?php

declare(strict_types=1);

namespace App\Modules\AI\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\AI\Http\Requests\StorePromptRequest;
use App\Modules\AI\Http\Requests\UpdatePromptRequest;
use App\Modules\AI\Http\Resources\PromptVersionResource;
use App\Modules\AI\Models\PromptVersion;
use App\Modules\Shared\Http\Controllers\Concerns\AuthorizesSuperAdmin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * Super Admin CRUD for `prompt_versions`. Spec: docs/10 §15.
 *
 * The lifecycle is `draft | approved | deprecated`. Creating a
 * new version automatically deprecates the previously approved
 * row of the same `name` (single-write transaction). The
 * `rollback` endpoint flips the deprecated row back to
 * `approved` and deprecates the new one.
 */
class AiPromptAdminController extends Controller
{
    use AuthorizesSuperAdmin;

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->ensureAdmin($request);
        $q = PromptVersion::query();

        if ($request->filled('name')) {
            $q->where('name', $request->string('name'));
        }

        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }

        return PromptVersionResource::collection(
            $q->orderBy('name')->orderByDesc('version')->paginate(50),
        );
    }

    public function show(Request $request, string $id): PromptVersionResource|JsonResponse
    {
        $this->ensureAdmin($request);
        $p = PromptVersion::query()->find($id);

        if ($p === null) {
            return response()->json(['message' => 'prompt_not_found'], 404);
        }

        return new PromptVersionResource($p);
    }

    public function store(StorePromptRequest $request): JsonResponse
    {
        $this->ensureAdmin($request);
        $data = $request->validated();
        $data['status'] = $data['status'] ?? PromptVersion::STATUS_DRAFT;
        $data['version'] = $data['version']
            ?? ((int) PromptVersion::query()->where('name', $data['name'])->max('version')) + 1;

        $prompt = PromptVersion::query()->create($data);

        return (new PromptVersionResource($prompt))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdatePromptRequest $request, string $id): PromptVersionResource|JsonResponse
    {
        $this->ensureAdmin($request);
        $prompt = PromptVersion::query()->find($id);

        if ($prompt === null) {
            return response()->json(['message' => 'prompt_not_found'], 404);
        }

        $prompt->update($request->validated());

        return new PromptVersionResource($prompt->refresh());
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->ensureAdmin($request);
        $prompt = PromptVersion::query()->find($id);

        if ($prompt === null) {
            return response()->json(['message' => 'prompt_not_found'], 404);
        }

        $prompt->delete();

        return response()->json(['status' => 'deleted', 'id' => $id]);
    }

    public function approve(Request $request, string $id): PromptVersionResource|JsonResponse
    {
        return $this->flipLifecycle($id, PromptVersion::STATUS_APPROVED, $request->user()?->id);
    }

    public function rollback(Request $request, string $id): PromptVersionResource|JsonResponse
    {
        return $this->flipLifecycle($id, PromptVersion::STATUS_APPROVED, $request->user()?->id, rollback: true);
    }

    private function flipLifecycle(string $id, string $toStatus, ?string $actorId, bool $rollback = false): PromptVersionResource|JsonResponse
    {
        $prompt = PromptVersion::query()->find($id);

        if ($prompt === null) {
            return response()->json(['message' => 'prompt_not_found'], 404);
        }

        $result = DB::transaction(function () use ($prompt, $toStatus, $actorId, $rollback) {
            $peer = PromptVersion::query()
                ->where('name', $prompt->name)
                ->where('id', '!=', $prompt->id)
                ->where('status', PromptVersion::STATUS_APPROVED)
                ->first();

            if ($rollback) {
                if ($prompt->status !== PromptVersion::STATUS_DEPRECATED) {
                    return response()->json(['message' => 'rollback_target_must_be_deprecated'], 422);
                }
            } else {
                if ($prompt->status === PromptVersion::STATUS_APPROVED) {
                    return response()->json(['message' => 'already_approved'], 422);
                }
            }

            if ($peer !== null) {
                $peer->update(['status' => PromptVersion::STATUS_DEPRECATED]);
            }

            $prompt->update([
                'status' => $toStatus,
                'approved_by' => $actorId,
                'approved_at' => now(),
            ]);

            return new PromptVersionResource($prompt->refresh());
        });

        return $result;
    }
}
