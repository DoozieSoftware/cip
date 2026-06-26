<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Users\Models;

use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * User factory for the Civic Intelligence Platform.
 *
 *  - Default state yields a baseline user (no role, no name).
 *  - Named states map to the platform's principal roles per docs/04 §6 and
 *    docs/11 §9:
 *      - citizen()           : verified citizen (otp_verified_at set, mobile set)
 *      - moderator()         : staff moderator (email + password set)
 *      - departmentOfficer() : staff department officer (email + password)
 *      - superAdmin()        : platform super admin (email + password)
 *
 * Module relations (refreshTokens, loginHistories, securityEvents, otps,
 * auditLogs) are NOT created here — they are produced by the flows that
 * own them (auth, security). The factory yields a bare principal.
 *
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /** The model produced by this factory. */
    protected $model = User::class;

    protected static ?string $password;

    /**
     * Default user state. Caller is expected to call a role state or fill
     * missing fields before persisting.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => null,
            'mobile' => $this->generateUniqueMobile(),
            'email' => null,
            'password' => null,
            'otp_verified_at' => null,
            'anonymous_enabled' => false,
            'status' => 'active',
            'last_login_at' => null,
            'last_login_ip' => null,
        ];
    }

    /**
     * Citizen: verified mobile, no email, no password, otp_verified_at set,
     * anonymous_enabled off by default.
     */
    public function citizen(): static
    {
        return $this->state(fn (): array => [
            'name' => $this->faker->name(),
            'mobile' => $this->generateUniqueMobile(),
            'email' => null,
            'password' => null,
            'otp_verified_at' => now(),
            'anonymous_enabled' => false,
            'status' => 'active',
        ]);
    }

    /**
     * Moderator staff: email + password, otp not applicable.
     */
    public function moderator(): static
    {
        return $this->state(fn (): array => [
            'name' => $this->faker->name(),
            'mobile' => $this->generateUniqueMobile(),
            'email' => $this->generateUniqueEmail(),
            'password' => static::$password ??= Hash::make('Password1!'),
            'otp_verified_at' => null,
            'anonymous_enabled' => false,
            'status' => 'active',
        ]);
    }

    /**
     * Department officer staff: same surface as moderator.
     */
    public function departmentOfficer(): static
    {
        return $this->state(fn (): array => [
            'name' => $this->faker->name(),
            'mobile' => $this->generateUniqueMobile(),
            'email' => $this->generateUniqueEmail(),
            'password' => static::$password ??= Hash::make('Password1!'),
            'otp_verified_at' => null,
            'anonymous_enabled' => false,
            'status' => 'active',
        ]);
    }

    /**
     * Super admin staff: email + password; status forced active.
     */
    public function superAdmin(): static
    {
        return $this->state(fn (): array => [
            'name' => $this->faker->name(),
            'mobile' => $this->generateUniqueMobile(),
            'email' => $this->generateUniqueEmail(),
            'password' => static::$password ??= Hash::make('Password1!'),
            'otp_verified_at' => null,
            'anonymous_enabled' => false,
            'status' => 'active',
        ]);
    }

    /**
     * Suspended user — keep the credentials, flip status to suspended.
     */
    public function suspended(): static
    {
        return $this->state(fn (): array => [
            'status' => 'suspended',
        ]);
    }

    /**
     * Anonymous-capable citizen: anonymous_enabled = true.
     */
    public function anonymous(): static
    {
        return $this->state(fn (): array => [
            'anonymous_enabled' => true,
        ]);
    }

    /**
     * 10-digit Indian mobile numbers — `9XXXXXXXXX`. Faker uniqueness
     * ensures the unique index is never violated during a single test run.
     */
    private function generateUniqueMobile(): string
    {
        do {
            $mobile = '9'.str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT);
        } while (User::query()->where('mobile', $mobile)->exists());

        return $mobile;
    }

    /**
     * Email like `firstname.lastname.{rand}@cip.test`. Faker unique() is
     * not safe across multiple factory classes in the same run, so we
     * combine Str::random with the unique mobile check pattern.
     */
    private function generateUniqueEmail(): string
    {
        do {
            $email = Str::lower(Str::random(10)).'@cip.test';
        } while (User::query()->where('email', $email)->exists());

        return $email;
    }
}
