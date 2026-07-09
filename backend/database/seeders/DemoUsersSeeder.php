<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Departments\Models\Department;
use App\Modules\Users\Models\User;
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
            'mobile' => '9999900001',
            'name' => 'Asha Citizen',
            'role' => 'citizen',
            'email' => 'asha@cip.demo',
            'password' => null,
        ],
        [
            'mobile' => '9999900002',
            'name' => 'Manish Moderator',
            'role' => 'moderator',
            'email' => 'manish@cip.demo',
            'password' => 'demo1234',
        ],
        [
            'mobile' => '9999900003',
            'name' => 'Deepa Dept Officer (BBMP)',
            'role' => 'department_officer',
            'department_code' => 'BBMP',
            'email' => 'deepa@cip.demo',
            'password' => 'demo1234',
        ],
        [
            'mobile' => '9999900004',
            'name' => 'Ravi Super Admin',
            'role' => 'super_admin',
            'email' => 'ravi@cip.demo',
            'password' => 'demo1234',
        ],
        [
            'mobile' => '9999900005',
            'name' => 'Anita Dept Admin (BBMP)',
            'role' => 'department_admin',
            'department_code' => 'BBMP',
            'email' => 'anita@cip.demo',
            'password' => 'demo1234',
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

            if (isset($row['password']) && $row['password'] !== null) {
                // The User model has a 'hashed' cast on the password
                // attribute, so assigning the plain value is enough —
                // the model will bcrypt it on save. Calling Hash::make()
                // here would double-hash and break password login.
                $user->password = $row['password'];
                $user->save();
            }

            if (! $user->hasRole($row['role'])) {
                $user->assignRole($row['role']);
            }

            if (isset($row['department_code'])) {
                $department = Department::query()
                    ->where('code', $row['department_code'])
                    ->first();

                if ($department !== null) {
                    $user->departments()->syncWithoutDetaching([
                        $department->id => [
                            'is_manager' => false,
                            'assigned_at' => now(),
                        ],
                    ]);
                }
            }
        }
    }
}
