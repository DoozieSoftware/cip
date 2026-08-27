<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    private const DEPARTMENT_CODE = 'DR_LINEN';

    public function up(): void
    {
        $now = now();
        $departmentId = DB::table('departments')->where('code', self::DEPARTMENT_CODE)->value('id');

        if (! is_string($departmentId)) {
            $departmentId = (string) Str::orderedUuid();
            DB::table('departments')->insert([
                'id' => $departmentId,
                'name' => 'Dr. Linen Textile Collection',
                'code' => self::DEPARTMENT_CODE,
                'jurisdiction' => 'Active Dr. Linen service zones in Bengaluru',
                'address' => null,
                'email' => null,
                'phone' => null,
                'working_hours' => json_encode([
                    'mon' => ['09:00', '17:30'], 'tue' => ['09:00', '17:30'],
                    'wed' => ['09:00', '17:30'], 'thu' => ['09:00', '17:30'],
                    'fri' => ['09:00', '17:30'], 'sat' => ['09:00', '13:00'],
                ]),
                'holiday_calendar' => json_encode([]),
                'default_workflow_id' => null,
                'default_sla_minutes' => 4320,
                'escalation_matrix' => json_encode([]),
                'active' => true,
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => null,
            ]);
        } else {
            DB::table('departments')->where('id', $departmentId)->update([
                'name' => 'Dr. Linen Textile Collection',
                'jurisdiction' => 'Active Dr. Linen service zones in Bengaluru',
                'active' => true,
                'deleted_at' => null,
                'updated_at' => $now,
            ]);
        }

        DB::table('routing_rules')
            ->where('name', 'Clothes, Metal Scrap & E-Waste -> BBMP SWM')
            ->update([
                'conditions' => json_encode(['category_in' => ['metal_scrap', 'e_waste']]),
                'name' => 'Metal Scrap & E-Waste -> BBMP SWM',
                'updated_at' => $now,
            ]);

        DB::table('routing_rules')
            ->where('name', 'Clothes & Textiles -> Dr. Linen')
            ->update(['active' => false, 'updated_at' => $now]);
    }

    public function down(): void
    {
        DB::table('routing_rules')
            ->where('name', 'Metal Scrap & E-Waste -> BBMP SWM')
            ->update([
                'name' => 'Clothes, Metal Scrap & E-Waste -> BBMP SWM',
                'conditions' => json_encode(['category_in' => ['clothes_waste', 'metal_scrap', 'e_waste']]),
                'updated_at' => now(),
            ]);
    }
};
