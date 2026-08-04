<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Services\DepartmentService;
use Illuminate\Database\Seeder;

/**
 * Master data: Bengaluru civic departments per the approved Phase 1
 * routing taxonomy (docs/department-routing-mapping.md):
 *
 *  - BBMP  — Bruhat Bengaluru Mahanagara Palike (parent; umbrella)
 *  - 10 BBMP wings — Roads, SWM, Electrical, SWD, Health, Animal
 *    Husbandry, Forest, Town Planning, Parks, Lakes
 *  - BTP / BWSSB / BESCOM — enforcement + utilities
 *  - KSPCB / BMTC / PWD / BDA — added for Phase 1 routing coverage
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

    /**
     * Phase 1 BBMP wings — children of BBMP (approved taxonomy,
     * docs/department-routing-mapping.md §2).
     *
     * @var list<array<string, int|string>>
     */
    private const BBMP_WINGS = [
        ['code' => 'BBMP_ENG', 'name' => 'BBMP Roads & Infrastructure (Engineering)', 'sla' => 1440],
        ['code' => 'BBMP_SWM', 'name' => 'BBMP Solid Waste Management (BSWML)', 'sla' => 1440],
        ['code' => 'BBMP_ELEC', 'name' => 'BBMP Electrical — Streetlight & Park Lighting', 'sla' => 1440],
        ['code' => 'BBMP_SWD', 'name' => 'BBMP Storm Water Drains & Lakes', 'sla' => 1440],
        ['code' => 'BBMP_HLTH', 'name' => 'BBMP Health Department', 'sla' => 1440],
        ['code' => 'BBMP_AH', 'name' => 'BBMP Animal Husbandry', 'sla' => 1440],
        ['code' => 'BBMP_FOR', 'name' => 'BBMP Forest Cell / Forest & Horticulture', 'sla' => 1440],
        ['code' => 'BBMP_TP', 'name' => 'BBMP Town Planning', 'sla' => 2880],
        ['code' => 'BBMP_PRK', 'name' => 'BBMP Parks & Playgrounds (Horticulture)', 'sla' => 1440],
        ['code' => 'BBMP_LAKE', 'name' => 'BBMP Lakes Department', 'sla' => 2880],
    ];

    /**
     * External agencies added in Phase 1. Helplines marked provisional
     * must be verified before public display (plan open item O1).
     *
     * @var list<array<string, int|string>>
     */
    private const EXTERNAL_AGENCIES = [
        ['code' => 'KSPCB', 'name' => 'Karnataka State Pollution Control Board', 'sla' => 2880, 'phone' => '080-25589112'],
        ['code' => 'BMTC', 'name' => 'Bangalore Metropolitan Transport Corporation Limited', 'sla' => 1440, 'phone' => '1800-425-1663'],
        ['code' => 'PWD', 'name' => 'Public Works Department, Government of Karnataka', 'sla' => 2880, 'phone' => '080-22211283'],
        ['code' => 'BDA', 'name' => 'Bangalore Development Authority', 'sla' => 2880, 'phone' => '080-23360825'],
    ];

    public function run(): void
    {
        foreach (self::DEPARTMENTS as $row) {
            $existing = Department::query()
                ->where('code', $row['code'])
                ->first();

            $attributes = $row;

            if ($existing === null) {
                $this->service->create($attributes);

                continue;
            }

            $this->service->update($existing, $attributes);
        }

        $bbmp = Department::query()->where('code', 'BBMP')->first();

        foreach (self::BBMP_WINGS as $wing) {
            $this->upsertDepartment([
                'code' => $wing['code'],
                'name' => $wing['name'],
                'jurisdiction' => 'BBMP, Bengaluru',
                'parent_id' => $bbmp?->id,
                'default_sla_minutes' => $wing['sla'],
                'escalation_matrix' => [
                    ['after_minutes' => 1440, 'escalate_to' => 'BBMP-ZONAL'],
                    ['after_minutes' => 4320, 'escalate_to' => 'BBMP-COMMISSIONER'],
                ],
            ]);
        }

        foreach (self::EXTERNAL_AGENCIES as $agency) {
            $this->upsertDepartment([
                'code' => $agency['code'],
                'name' => $agency['name'],
                'jurisdiction' => 'Bengaluru Urban',
                'parent_id' => null,
                'phone' => $agency['phone'],
                'default_sla_minutes' => $agency['sla'],
                'escalation_matrix' => [],
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function upsertDepartment(array $attributes): void
    {
        $workingHours = [
            'mon' => ['09:00', '17:30'],
            'tue' => ['09:00', '17:30'],
            'wed' => ['09:00', '17:30'],
            'thu' => ['09:00', '17:30'],
            'fri' => ['09:00', '17:30'],
            'sat' => ['09:00', '13:00'],
        ];
        $holidayCalendar = [
            '2026-01-26', '2026-08-15', '2026-10-02',
            '2026-11-01', '2026-11-08', '2026-12-25',
        ];

        $attributes = array_merge([
            'working_hours' => $workingHours,
            'holiday_calendar' => $holidayCalendar,
        ], $attributes);

        $existing = Department::query()->where('code', $attributes['code'])->first();

        if ($existing === null) {
            $this->service->create($attributes);

            return;
        }

        $this->service->update($existing, $attributes);
    }
}
