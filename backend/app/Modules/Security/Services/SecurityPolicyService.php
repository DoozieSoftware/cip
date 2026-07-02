<?php

declare(strict_types=1);

namespace App\Modules\Security\Services;

use App\Modules\Security\Models\SecurityPolicy;
use Illuminate\Validation\Rules\Password;

/**
 * Reads `security_policies` rows and turns them into real validation
 * rules. Before this class existed, the Security Policies admin
 * screen was pure CRUD theater — a Super Admin could edit
 * `password.min_length` and nothing in the codebase would ever read
 * the row back (a Critical finding in the post-audit remediation).
 *
 * `passwordRule()` is the first policy actually wired to runtime
 * behaviour: it backs both staff account creation
 * (`StoreUserRequest`/`UpdateUserRequest`) and is the single source
 * of truth docs/11 §8 describes. OTP expiry / rate-limit policy
 * wiring is a tracked fast-follow, not covered here.
 */
class SecurityPolicyService
{
    public const PASSWORD_POLICY_KEY = 'password.min_length';

    /**
     * Defaults match docs/11 §8 exactly (min 12, upper+lower case,
     * number, special character) — used only when no policy row
     * exists yet (e.g. a fresh install before the seeder runs).
     */
    private const DEFAULT_MIN = 12;

    public function passwordRule(): Password
    {
        $policy = SecurityPolicy::query()->where('key', self::PASSWORD_POLICY_KEY)->first();
        $value = $policy instanceof SecurityPolicy ? ($policy->value ?? []) : [];

        $min = $value['min'] ?? self::DEFAULT_MIN;
        $rule = Password::min(is_numeric($min) ? (int) $min : self::DEFAULT_MIN);

        if ($value['require_mixed_case'] ?? true) {
            $rule = $rule->mixedCase();
        }

        if ($value['require_number'] ?? true) {
            $rule = $rule->numbers();
        }

        if ($value['require_symbol'] ?? true) {
            $rule = $rule->symbols();
        }

        return $rule;
    }
}
