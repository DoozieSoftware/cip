<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Database\Seeder;

/**
 * T-Demo — Stakeholder demo accounts.
 *
 * Idempotent: updateOrCreate on mobile. Roles are assigned
 * by name (must already exist in `RolesAndPermissionsSeeder`).
 *
 * Mobile numbers (E.164):
 *   +919999900001  — Citizen
 *   +919999900002  — Moderator
 *   +919999900003  — Department officer (BBMP)
 *   +919999900004  — Super admin
 *
 * The OTP in dev is deterministic and printed in the
 * `auth/send-otp` response (see docs/11 §21 and the
 * `Authentication` module's `LogSmsGateway` driver).
 */
class DemoUsersSeeder extends Seeder
{
    /**
     * @var list<array<string, string>>
     */
    private const ACCOUNTS = [
        [
            'mobile' => '+919999900001',
            'name' => 'Asha Citizen',
            'role' => 'citizen',
            'email' => 'asha@cip.demo',
        ],
        [
            'mobile' => '+919999900002',
            'name' => 'Manish Moderator',
            'role' => 'moderator',
            'email' => 'manish@cip.demo',
        ],
        [
            'mobile' => '+919999900003',
            'name' => 'Deepa Dept Officer (BBMP)',
            'role' => 'department_officer',
            'email' => 'deepa@cip.demo',
        ],
        [
            'mobile' => '+919999900004',
            'name' => 'Ravi Super Admin',
            'role' => 'super_admin',
            'email' => 'ravi@cip.demo',
        ],
    ];

    public function run(): void
    {
        // Make sure roles exist before we assign them.
        (new RolesAndPermissionsSeeder)->run();

        foreach (self::ACCOUNTS as $row) {
            $user = User::query()->updateOrCreate(
                ['mobile' => $row['mobile']],
                [
                    'name' => $row['name'],
                    'email' => $row['email'],
                    'status' => 'active',
                ],
            );
            if (! $user->hasRole($row['role'])) {
                $user->assignRole($row['role']);
            }
        }
    }
}
