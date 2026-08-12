<?php

declare(strict_types=1);

namespace App\Modules\Users\Http\Controllers\Api;

use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Users\Http\Requests\UpdateProfileRequest;
use App\Modules\Users\Http\Resources\UserResource;
use App\Modules\Users\Models\User;
use App\Modules\Users\Services\ProfileService;
use Illuminate\Http\JsonResponse;

/** Citizen self-service profile endpoint (no office visit required). */
class ProfileController extends BaseController
{
    public function __construct(private readonly ProfileService $service) {}

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user('sanctum');

        if (! $user instanceof User) {
            return $this->respondError('Unauthenticated.', 401, 'UNAUTHORIZED');
        }

        $updated = $this->service->update($user, $request->validated());

        return $this->respond(
            (new UserResource($updated->load(['roles', 'departments'])))->toArray($request),
            'Profile updated.',
        );
    }
}
