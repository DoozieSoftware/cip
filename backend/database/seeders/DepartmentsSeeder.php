<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Services\DepartmentService;
use Illuminate\Database\Seeder;

/**
 * Master data: the four departments every Bengaluru civic
 * report routes to (per docs/04 §8 + docs/09 §7).
 *
 *  - BBMP  — Bruhat Bengaluru Mahanagara Palike (roads,
 *    solid-waste, streetlights, footpaths, parks)
 *  - BTP   — Bengaluru Traffic Police (signals, signs, traffic
 *    enforcement, accident reporting)
 *  - BWSSB — Bangalore Water Supply and Sewerage Board
 *    (water supply, sewerage, drainage)
 *  - BESCOM — Bangalore Electricity Supply Company
 *    (streetlight power, electrical hazards, outages)
 *
 * Every row carries:
 *  - a jurisdiction string the Routing engine can match on
 *  - a default_workflow_id (the workflow id from T-M6-*)
 *    — left null at seed time because M6 has not run yet;
 *    a follow-up seed or Super Admin edit fills it in.
 *  - a default_sla_minutes matching the M3 SLA policy
 *  - a 9×5 working_hours block and a small escalation matrix
 *
 * The seeder is idempotent — `updateOrCreate` on `code`.
 */
class DepartmentsSeeder extends Seeder
{
    public function __construct(
        private readonly DepartmentService $service,
    ) {}

    /**
     * @var list<array<string, mixed>>
     */
    private const DEPARTMENTS = [
        [
            'name' => 'Bruhat Bengaluru Mahanagara Palike',
            'code' => 'BBMP',
            'jurisdiction' => 'BBMP',
            'address' => 'N.R. Square, Bengaluru 560002',
            'email' => 'commissioner@bbmp.gov.in',
            'phone' => '080-22975500',
            'default_sla_minutes' => 2880, // 48h
            'working_hours' => [
                'mon' => ['09:00', '17:30'],
                'tue' => ['09:00', '17:30'],
                'wed' => ['09:00', '17:30'],
                'thu' => ['09:00', '17:30'],
                'fri' => ['09:00', '17:30'],
                'sat' => ['09:00', '13:00'],
            ],
            'holiday_calendar' => [
                '2026-01-26', '2026-08-15', '2026-10-02',
                '2026-11-01', '2026-11-08', '2026-12-25',
            ],
            'escalation_matrix' => [
                ['after_minutes' => 1440, 'escalate_to' => 'BBMP-ZONAL'],
                ['after_minutes' => 4320, 'escalate_to' => 'BBMP-COMMISSIONER'],
            ],
        ],
        [
            'name' => 'Bengaluru Traffic Police',
            'code' => 'BTP',
            'jurisdiction' => 'BTP',
            'address' => ' Infantry Road, Bengaluru 560001',
            'email' => 'jtcp@btp.gov.in',
            'phone' => '080-22943225',
            'default_sla_minutes' => 720, // 12h
            'working_hours' => [
                'mon' => ['00:00', '23:59'],
                'tue' => ['00:00', '23:59'],
                'wed' => ['00:00', '23:59'],
                'thu' => ['00:00', '23:59'],
                'fri' => ['00:00', '23:59'],
                'sat' => ['00:00', '23:59'],
                'sun' => ['00:00', '23:59'],
            ],
            'holiday_calendar' => [],
            'escalation_matrix' => [
                ['after_minutes' => 360, 'escalate_to' => 'BTP-DCP'],
                ['after_minutes' => 1440, 'escalate_to' => 'BTP-JOINT-CP'],
            ],
        ],
        [
            'name' => 'Bangalore Water Supply and Sewerage Board',
            'code' => 'BWSSB',
            'jurisdiction' => 'BWSSB',
            'address' => 'Cauvery Bhavan, K.G. Road, Bengaluru 560009',
            'email' => 'chairman@bwssb.gov.in',
            'phone' => '080-22945100',
            'default_sla_minutes' => 1440, // 24h
            'working_hours' => [
                'mon' => ['09:30', '17:00'],
                'tue' => ['09:30', '17:00'],
                'wed' => ['09:30', '17:00'],
                'thu' => ['09:30', '17:00'],
                'fri' => ['09:30', '17:00'],
                'sat' => ['09:30', '13:00'],
            ],
            'holiday_calendar' => [
                '2026-01-26', '2026-08-15', '2026-10-02',
                '2026-11-01', '2026-11-08', '2026-12-25',
            ],
            'escalation_matrix' => [
                ['after_minutes' => 720, 'escalate_to' => 'BWSSB-AEE'],
                ['after_minutes' => 2880, 'escalate_to' => 'BWSSB-EE'],
            ],
        ],
        [
            'name' => 'Bangalore Electricity Supply Company',
            'code' => 'BESCOM',
            'jurisdiction' => 'BESCOM',
            'address' => 'K.R. Circle, Bengaluru 560001',
            'email' => 'cmd@bescom.co.in',
            'phone' => '080-22353999',
            'default_sla_minutes' => 1440, // 24h
            'working_hours' => [
                'mon' => ['09:00', '17:00'],
                'tue' => ['09:00', '17:00'],
                'wed' => ['09:00', '17:00'],
                'thu' => ['09:00', '17:00'],
                'fri' => ['09:00', '17:00'],
                'sat' => ['09:00', '13:00'],
            ],
            'holiday_calendar' => [
                '2026-01-26', '2026-08-15', '2026-10-02',
                '2026-11-01', '2026-11-08', '2026-12-25',
            ],
            'escalation_matrix' => [
                ['after_minutes' => 720, 'escalate_to' => 'BESCOM-AEE'],
                ['after_minutes' => 2880, 'escalate_to' => 'BESCOM-EE'],
            ],
        ],
    ];

    public function run(): void
    {
        foreach (self::DEPARTMENTS as $row) {
            $existing = Department::query()
                ->where('code', $row['code'])
                ->first();

            $attributes = array_filter($row, static fn ($v): bool => $v !== null);

            if ($existing === null) {
                $this->service->create($attributes);

                continue;
            }

            $this->service->update($existing, $attributes);
        }
    }
}
