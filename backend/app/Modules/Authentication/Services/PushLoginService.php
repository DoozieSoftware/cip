<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Services;

use App\Modules\Authentication\Models\PushLoginChallenge;
use App\Modules\Authentication\Models\RefreshToken;
use App\Modules\Notifications\Jobs\SendPushLoginApprovalJob;
use App\Modules\Notifications\Models\PushSubscription;
use App\Modules\Security\Services\SecurityEventService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\NewAccessToken;

class PushLoginService
{
    private const TTL_MINUTES = 5;

    public function __construct(
        private readonly AuthenticationService $auth,
        private readonly SecurityEventService $securityEvents,
    ) {}

    /** @return array{challenge_id: string, request_secret: string, expires_at: string} */
    public function request(string $mobile, ?string $ip, ?string $userAgent): array
    {
        $requestSecret = bin2hex(random_bytes(32));
        $approvalSecret = bin2hex(random_bytes(32));
        $user = User::query()
            ->where('mobile', $mobile)
            ->where('status', 'active')
            ->whereNull('deleted_at')
            ->first();

        if ($user !== null && ! PushSubscription::query()->where('user_id', $user->id)->exists()) {
            $user = null;
        }

        $challenge = PushLoginChallenge::query()->create([
            'user_id' => $user?->id,
            'request_secret_hash' => hash('sha256', $requestSecret),
            'approval_secret_hash' => hash('sha256', $approvalSecret),
            'status' => 'pending',
            'request_ip' => $ip,
            'request_user_agent' => $userAgent,
            'expires_at' => now()->addMinutes(self::TTL_MINUTES),
        ]);

        if ($user !== null) {
            SendPushLoginApprovalJob::dispatch(
                (string) $challenge->id,
                Crypt::encryptString($approvalSecret),
            );
        }

        return [
            'challenge_id' => (string) $challenge->id,
            'request_secret' => $requestSecret,
            'expires_at' => $challenge->expires_at->toIso8601String(),
        ];
    }

    public function decide(string $id, string $approvalSecret, User $actor, bool $approve): string
    {
        return DB::transaction(function () use ($id, $approvalSecret, $actor, $approve): string {
            $challenge = PushLoginChallenge::query()->lockForUpdate()->find($id);

            if ($challenge === null
                || ! hash_equals($challenge->approval_secret_hash, hash('sha256', $approvalSecret))
                || $challenge->user_id !== $actor->id) {
                $this->securityEvents->recordSafe(
                    'PUSH_LOGIN_APPROVAL_DENIED',
                    SecurityEventService::SEVERITY_WARNING,
                    ['challenge_id' => $id],
                    $actor,
                );

                throw ApiException::forbidden('This sign-in request cannot be approved from this account.');
            }

            if ($challenge->expires_at->isPast()) {
                $challenge->update(['status' => 'expired', 'decided_at' => now()]);

                throw new ApiException('PUSH_LOGIN_EXPIRED', 'This sign-in request has expired.', 410);
            }

            if ($challenge->status !== 'pending') {
                throw new ApiException('PUSH_LOGIN_ALREADY_DECIDED', 'This sign-in request was already handled.', 409);
            }

            $status = $approve ? 'approved' : 'rejected';
            $challenge->update([
                'status' => $status,
                'approved_by' => $actor->id,
                'decided_at' => now(),
            ]);
            $this->securityEvents->recordSafe(
                $approve ? 'PUSH_LOGIN_APPROVED' : 'PUSH_LOGIN_REJECTED',
                SecurityEventService::SEVERITY_INFO,
                ['challenge_id' => $id],
                $actor,
            );

            return $status;
        });
    }

    /**
     * @return array{
     *   status: string,
     *   session?: array{
     *     token: NewAccessToken,
     *     refresh: array{token: RefreshToken, plain: string, expires_at: Carbon},
     *     user: User,
     *     access_token: string
     *   }
     * }
     */
    public function exchange(string $id, string $requestSecret, ?string $ip, ?string $userAgent): array
    {
        return DB::transaction(function () use ($id, $requestSecret, $ip, $userAgent): array {
            $challenge = PushLoginChallenge::query()->lockForUpdate()->find($id);

            if ($challenge === null
                || ! hash_equals($challenge->request_secret_hash, hash('sha256', $requestSecret))) {
                throw ApiException::unauthorized('Invalid sign-in request.');
            }

            if ($challenge->expires_at->isPast()) {
                if ($challenge->status === 'pending') {
                    $challenge->update(['status' => 'expired']);
                }

                return ['status' => 'expired'];
            }

            if (in_array($challenge->status, ['pending', 'rejected', 'expired'], true)) {
                return ['status' => $challenge->status];
            }

            if ($challenge->status !== 'approved' || $challenge->consumed_at !== null || $challenge->user === null) {
                return ['status' => 'consumed'];
            }

            $session = $this->auth->loginAfterPushApproval($challenge->user, $ip, $userAgent);
            $challenge->update(['status' => 'consumed', 'consumed_at' => now()]);

            return ['status' => 'approved', 'session' => $session];
        });
    }
}
