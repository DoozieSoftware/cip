<?php

declare(strict_types=1);

namespace App\Modules\Settings\Services;

use App\Modules\Settings\Models\AppConfig;
use App\Modules\Users\Models\User;

/**
 * FeatureFlagService per docs/04 §18 and docs/09 §18.
 *
 * Evaluates a feature flag for a given user (or anonymous
 * session) using three ordered rules:
 *
 *   1. `enabled` master switch — false short-circuits to false.
 *   2. `cohort` match — if the user matches at least one
 *      predicate object, the flag is true regardless of
 *      `rollout_percentage`.
 *   3. `rollout_percentage` — deterministic hash of
 *      `sprintf('%s:%s', $key, $userId ?? $sessionId)` modulo
 *      100. Same user always gets the same answer.
 *
 * For an anonymous caller (no User, no session), the flag is
 * true only if `rollout_percentage === 100` and the flag is
 * enabled (or the cohort matches a wildcard — cohort matching
 * is impossible without a user, so this collapses to the
 * rollout path).
 */
class FeatureFlagService
{
    /**
     * Evaluate the flag. Returns true if the feature is on for
     * this caller; false otherwise.
     */
    public function enabled(string $key, ?User $user = null, ?string $sessionId = null): bool
    {
        $config = AppConfig::query()->where('key', $key)->first();

        if ($config === null || ! $config->enabled) {
            return false;
        }

        // Rule 2: cohort match.
        if ($user !== null && $this->matchesCohort($user, $config->cohort)) {
            return true;
        }

        // Rule 3: rollout percentage.
        $rollout = max(0, min(100, (int) $config->rollout_percentage));

        if ($rollout === 0) {
            return false;
        }

        if ($rollout === 100) {
            return true;
        }

        $bucketKey = $this->bucketKey($key, $user, $sessionId);

        return $this->bucket($bucketKey) < $rollout;
    }

    /**
     * @param  array<int, array<string, mixed>>|null  $cohort
     */
    private function matchesCohort(?User $user, ?array $cohort): bool
    {
        if ($cohort === null || $cohort === [] || $user === null) {
            return false;
        }

        foreach ($cohort as $predicate) {
            if ($this->matchesPredicate($user, $predicate)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $predicate
     */
    private function matchesPredicate(User $user, array $predicate): bool
    {
        foreach ($predicate as $attribute => $expected) {
            $actual = $this->resolveUserAttribute($user, (string) $attribute);

            if ($actual === null) {
                return false;
            }

            // Array "in" semantics: if expected is an array,
            // the user matches when the actual value is in it.
            if (is_array($expected)) {
                if (! in_array($actual, $expected, true)) {
                    return false;
                }
                continue;
            }

            if ($actual !== $expected) {
                return false;
            }
        }

        return true;
    }

    private function resolveUserAttribute(User $user, string $attribute): mixed
    {
        // Special pseudo-attributes first.
        return match ($attribute) {
            'id' => $user->id,
            'role' => $user->getRoleNames()->first(),
            default => $user->getAttribute($attribute),
        };
    }

    private function bucketKey(string $key, ?User $user, ?string $sessionId): string
    {
        $id = (is_object($user) ? $user->id : null) ?? $sessionId ?? 'anon';

        return $key.':'.$id;
    }

    /**
     * Deterministic 0-99 bucket for the given key, using SHA-256
     * so the bucket distribution is uniform and the result is
     * stable across processes.
     */
    private function bucket(string $bucketKey): int
    {
        $hex = hash('sha256', $bucketKey);

        // Take the first 8 hex chars (32 bits) and modulo 100.
        // crc32 is faster but its 32-bit domain produces a
        // distribution that is biased at the 100 boundary on
        // small samples; SHA-256's first 32 bits are uniform.
        $int = hexdec(substr($hex, 0, 8));

        return (int) ($int % 100);
    }
}
