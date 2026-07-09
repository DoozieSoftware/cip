<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Services;

use App\Modules\Authentication\Models\RefreshToken;
use App\Modules\Security\Services\SecurityEventService;
use App\Modules\Security\Services\SecurityPolicyService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Services\BaseService;
use App\Modules\Users\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Refresh token issuance, rotation, and revocation.
 *
 * Per docs/11 §7 (Refresh Token Rotation): on every successful
 * authentication a new refresh token is issued and the parent token is
 * marked revoked. A reused parent token is treated as theft — see
 * `rotate()`.
 *
 * Tokens are stored as bcrypt hashes; the opaque plaintext is returned
 * to the caller exactly once (when the token is issued) and is never
 * persisted.
 */
class RefreshTokenService extends BaseService
{
    /**
     * Default refresh-token lifetime: 14 days.
     * Configurable via `config('cip.auth.refresh_ttl_days')`.
     */
    private int $ttlDays;

    public function __construct(
        private readonly SecurityEventService $securityEvents,
    ) {
        $this->ttlDays = app(SecurityPolicyService::class)->jwtRefreshTtlDays();
    }

    /**
     * Issue a new refresh token for the given user. The opaque plaintext
     * is returned alongside the persisted model; the caller must return
     * the plaintext to the client exactly once.
     *
     * @return array{token: RefreshToken, plain: string, expires_at: Carbon}
     */
    public function issue(User $user, ?string $ip = null, ?string $userAgent = null): array
    {
        $plain = $this->generateOpaqueToken();
        $hash = password_hash($plain, PASSWORD_BCRYPT);

        $token = new RefreshToken([
            'user_id' => $user->id,
            'token_hash' => $hash,
            'parent_id' => null,
            'expires_at' => now()->addDays($this->ttlDays),
            'revoked_at' => null,
            'ip' => $ip,
            'user_agent' => $userAgent,
            'created_at' => now(),
        ]);
        $token->save();

        return [
            'token' => $token,
            'plain' => $plain,
            'expires_at' => $token->expires_at,
        ];
    }

    /**
     * Rotate a refresh token: revoke the parent and issue a new one.
     *
     * Reuse of a revoked or expired parent is treated as theft — every
     * descendant in the chain is revoked and the operation throws.
     *
     * @return array{token: RefreshToken, plain: string, expires_at: Carbon, user: User}
     */
    public function rotate(string $plaintext, ?string $ip = null, ?string $userAgent = null): array
    {
        $current = $this->findByPlaintext($plaintext);

        if ($current === null) {
            throw new ApiException(
                'REFRESH_TOKEN_INVALID',
                'Refresh token not recognised.',
                401,
            );
        }

        if ($current->isExpired()) {
            throw new ApiException(
                'REFRESH_TOKEN_EXPIRED',
                'Refresh token has expired.',
                401,
            );
        }

        if ($current->isRevoked()) {
            // Reuse of a revoked token = treat as theft.
            $this->revokeChain($current);

            throw new ApiException(
                'REFRESH_TOKEN_REPLAY',
                'Refresh token reuse detected; session terminated.',
                401,
            );
        }

        $user = $current->user;

        if ($user === null) {
            throw new ApiException('ORPHAN_REFRESH_TOKEN', 'Refresh token has no user.', 401);
        }

        $current->markRevoked();

        $plain = $this->generateOpaqueToken();
        $hash = password_hash($plain, PASSWORD_BCRYPT);

        $next = new RefreshToken([
            'user_id' => $user->id,
            'token_hash' => $hash,
            'parent_id' => $current->id,
            'expires_at' => now()->addDays($this->ttlDays),
            'revoked_at' => null,
            'ip' => $ip,
            'user_agent' => $userAgent,
            'created_at' => now(),
        ]);
        $next->save();

        return [
            'token' => $next,
            'plain' => $plain,
            'expires_at' => $next->expires_at,
            'user' => $user,
        ];
    }

    /**
     * Revoke a single refresh token (logout flow).
     */
    public function revoke(string $plaintext): bool
    {
        $token = $this->findByPlaintext($plaintext);

        if ($token === null) {
            return false;
        }

        if ($token->isRevoked()) {
            return true;
        }
        $token->markRevoked();

        return true;
    }

    /**
     * Revoke every active refresh token belonging to a user (forced
     * logout / account compromise).
     */
    public function revokeAllForUser(User $user): int
    {
        return RefreshToken::query()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);
    }

    /**
     * Find a refresh token row by the opaque plaintext. The plaintext
     * is matched against the bcrypt hash, which is constant-time and
     * immune to timing attacks.
     */
    private function findByPlaintext(string $plaintext): ?RefreshToken
    {
        $candidates = RefreshToken::query()
            ->whereNull('revoked_at')
            ->orWhere('expires_at', '>=', now())
            ->get();

        foreach ($candidates as $candidate) {
            if (password_verify($plaintext, $candidate->token_hash)) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * Revoke every token in the rotation chain rooted at $token.
     * Triggered when a revoked parent is presented — by definition
     * that's token theft and the entire chain must die. We also
     * emit a REFRESH_TOKEN_REPLAY security event so security can
     * alert on it.
     */
    private function revokeChain(RefreshToken $token): void
    {
        $cursor = $token;
        $cursor->markRevoked();

        while (($child = RefreshToken::query()->where('parent_id', $cursor->id)->first()) !== null) {
            $child->markRevoked();
            $cursor = $child;
        }

        $this->securityEvents->recordSafe(
            event: 'REFRESH_TOKEN_REPLAY',
            severity: 'critical',
            metadata: [
                'user_id' => $token->user_id,
                'token_id' => $token->id,
                'ip' => $token->ip,
                'user_agent' => $token->user_agent,
            ],
            user: $token->user,
        );
    }

    /**
     * 64-char URL-safe opaque random token. Roughly 384 bits of entropy.
     */
    private function generateOpaqueToken(): string
    {
        return Str::random(64);
    }
}
