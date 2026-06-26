<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Departments\Models\Department;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Routing\Models\RoutingRule;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds the three documented sample routing rules
 * per docs/02 sec 12:
 *
 *   1. Garbage  -> BBMP Ward 112
 *   2. Pothole  -> BBMP Ward 112
 *   3. Illegal Parking -> Bangalore Traffic Police (BTP)
 *
 * The two BBMP rules share the same destination so a
 * citizen's complaint lands with the right ward officer
 * regardless of whether it is garbage or a pothole.
 * Illegal parking is a different department (BTP) because
 * parking enforcement is a separate municipal body.
 *
 * The seeder is idempotent: every rule is matched on
 * `(name)` via `updateOrCreate` so re-running the seeder
 * is a no-op. The two destination departments are
 * upserted by `(code)` for the same reason.
 */
class RoutingRulesSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $bbmp = $this->ensureDepartment(
                code: 'BBMP_WARD_112',
                name: 'BBMP Ward 112',
                jurisdiction: 'BBMP Ward 112, Bengaluru',
            );

            $btp = $this->ensureDepartment(
                code: 'BTP_TRAFFIC',
                name: 'Bangalore Traffic Police (BTP)',
                jurisdiction: 'Bengaluru Urban',
            );

            $medium = ReportPriority::query()->where('code', 'medium')->firstOrFail();
            $high = ReportPriority::query()->where('code', 'high')->firstOrFail();

            $this->ensureRule(
                name: 'Garbage -> BBMP Ward 112',
                priority: 10,
                conditions: ['category_in' => ['garbage', 'illegal_dumping', 'dead_animal', 'open_drain']],
                destinationDepartment: $bbmp,
                defaultPriority: $medium,
                defaultSlaMinutes: 1440,
            );

            $this->ensureRule(
                name: 'Pothole -> BBMP Ward 112',
                priority: 20,
                conditions: ['category_in' => ['pothole', 'road_damage']],
                destinationDepartment: $bbmp,
                defaultPriority: $medium,
                defaultSlaMinutes: 1440,
            );

            $this->ensureRule(
                name: 'Illegal Parking -> BTP',
                priority: 30,
                conditions: ['category_in' => ['illegal_parking', 'encroachment']],
                destinationDepartment: $btp,
                defaultPriority: $high,
                defaultSlaMinutes: 480,
            );
        });
    }

    private function ensureDepartment(string $code, string $name, string $jurisdiction): Department
    {
        return Department::query()->updateOrCreate(
            ['code' => $code],
            [
                'name' => $name,
                'jurisdiction' => $jurisdiction,
                'active' => true,
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $conditions
     */
    private function ensureRule(
        string $name,
        int $priority,
        array $conditions,
        Department $destinationDepartment,
        ReportPriority $defaultPriority,
        int $defaultSlaMinutes,
    ): RoutingRule {
        return RoutingRule::query()->updateOrCreate(
            ['name' => $name],
            [
                'description' => 'Bangalore sample routing rule.',
                'priority' => $priority,
                'conditions' => $conditions,
                'destination_department_id' => $destinationDepartment->id,
                'default_officer_id' => null,
                'default_priority_id' => $defaultPriority->id,
                'default_sla_minutes' => $defaultSlaMinutes,
                'active' => true,
            ],
        );
    }
}
