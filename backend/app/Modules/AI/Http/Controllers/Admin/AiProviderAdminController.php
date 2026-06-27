<?php

declare(strict_types=1);

namespace App\Modules\AI\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\AI\Http\Requests\StoreAiProviderRequest;
use App\Modules\AI\Http\Requests\UpdateAiProviderRequest;
use App\Modules\AI\Http\Resources\AiProviderConfigResource;
use App\Modules\AI\Models\AiProviderConfig;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Super Admin CRUD for `ai_provider_configs`. Spec: docs/09 §13.
 *
 * - index/show use the resource (which hides the secret).
 * - store/update accept `api_key_secret_id` (write-only — the
 *   resource never serialises it back).
 * - delete is soft-delete via the model's SoftDeletes trait when
 *   one is added in a later milestone; for now we hard-delete.
 */
class AiProviderAdminController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->ensureAdmin($request);

        $q = AiProviderConfig::query();

        if ($request->filled('active')) {
            $q->where('active', $request->boolean('active'));
        }

        return AiProviderConfigResource::collection(
            $q->orderBy('priority')->orderBy('code')->paginate(50),
        );
    }

    public function show(Request $request, string $id): AiProviderConfigResource|JsonResponse
    {
        $this->ensureAdmin($request);
        $cfg = AiProviderConfig::query()->find($id);

        if ($cfg === null) {
            return response()->json(['message' => 'provider_not_found'], 404);
        }

        return new AiProviderConfigResource($cfg);
    }

    public function store(StoreAiProviderRequest $request): JsonResponse
    {
        $this->ensureAdmin($request);
        $cfg = AiProviderConfig::query()->create($request->validated());

        return (new AiProviderConfigResource($cfg))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateAiProviderRequest $request, string $id): AiProviderConfigResource|JsonResponse
    {
        $this->ensureAdmin($request);
        $cfg = AiProviderConfig::query()->find($id);

        if ($cfg === null) {
            return response()->json(['message' => 'provider_not_found'], 404);
        }

        $cfg->update($request->validated());

        return new AiProviderConfigResource($cfg->refresh());
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->ensureAdmin($request);
        $cfg = AiProviderConfig::query()->find($id);

        if ($cfg === null) {
            return response()->json(['message' => 'provider_not_found'], 404);
        }

        $cfg->delete();

        return response()->json(['status' => 'deleted', 'id' => $id]);
    }

    private function ensureAdmin(Request $request): void
    {
        $user = $request->user();

        if ($user === null || ! $user->hasRole('super_admin')) {
            throw ApiException::forbidden('super_admin role is required.');
        }
    }
}
