<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Http\Controllers;

use App\Modules\Authentication\Http\Requests\DecidePushLoginRequest;
use App\Modules\Authentication\Http\Requests\ExchangePushLoginRequest;
use App\Modules\Authentication\Http\Requests\RequestPushLoginRequest;
use App\Modules\Authentication\Services\PushLoginService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\Users\Http\Resources\UserResource;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;

class PushLoginController extends BaseController
{
    public function __construct(private readonly PushLoginService $pushLogin) {}

    public function request(RequestPushLoginRequest $request): JsonResponse
    {
        return $this->respond($this->pushLogin->request(
            $request->mobile(),
            $request->ip(),
            $request->userAgent(),
        ), 'If a trusted device is available, an approval request has been sent.');
    }

    public function exchange(string $challenge, ExchangePushLoginRequest $request): JsonResponse
    {
        try {
            $result = $this->pushLogin->exchange(
                $challenge,
                $request->requestSecret(),
                $request->ip(),
                $request->userAgent(),
            );
        } catch (ApiException $exception) {
            return $this->respondError($exception->getMessage(), $exception->httpStatus, $exception->errorCode);
        }

        if (! isset($result['session'])) {
            return $this->respond(['status' => $result['status']]);
        }

        $session = $result['session'];
        /** @var User $user */
        $user = $session['user'];

        return $this->respond([
            'status' => 'approved',
            'token' => [
                'access_token' => $session['access_token'],
                'type' => 'Bearer',
                'expires_at' => $session['token']->accessToken->expires_at?->toIso8601String(),
            ],
            'refresh_token' => $session['refresh']['plain'],
            'refresh_expires_at' => $session['refresh']['expires_at']->toIso8601String(),
            'user' => (new UserResource($user->load(['roles', 'departments'])))->toArray($request),
        ]);
    }

    public function approve(string $challenge, DecidePushLoginRequest $request): JsonResponse
    {
        return $this->decide($challenge, $request, true);
    }

    public function reject(string $challenge, DecidePushLoginRequest $request): JsonResponse
    {
        return $this->decide($challenge, $request, false);
    }

    private function decide(string $challenge, DecidePushLoginRequest $request, bool $approve): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return $this->respondError('Unauthenticated.', 401, 'UNAUTHORIZED');
        }

        try {
            $status = $this->pushLogin->decide($challenge, $request->approvalSecret(), $user, $approve);
        } catch (ApiException $exception) {
            return $this->respondError($exception->getMessage(), $exception->httpStatus, $exception->errorCode);
        }

        return $this->respond(['status' => $status]);
    }
}
