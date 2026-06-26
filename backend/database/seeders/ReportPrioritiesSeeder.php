<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Reports\Models\ReportPriority;
use Illuminate\Database\Seeder;

/**
 * Seeds the 5 priority levels per docs/04 §7:
 *   Low (7d), Medium (3d), High (24h), Critical (4h), Emergency (1h).
 *
 * Idempotent: `updateOrCreate` on `code`.
 */
class ReportPrioritiesSeeder extends Seeder
{
    /**
     * SLA minutes chosen to align with the spec's "severity drives
     * SLA" intent: emergencies need an on-call response within an
     * hour, low-priority tickets have a full week.
     *
     * @var list<array<string, mixed>>
     */
    private const PRIORITIES = [
        ['code' => 'low', 'name' => 'Low', 'sla_minutes' => 7 * 24 * 60, 'color' => '#8BC34A', 'sort_order' => 10],
        ['code' => 'medium', 'name' => 'Medium', 'sla_minutes' => 3 * 24 * 60, 'color' => '#FFC107', 'sort_order' => 20],
        ['code' => 'high', 'name' => 'High', 'sla_minutes' => 24 * 60, 'color' => '#FF9800', 'sort_order' => 30],
        ['code' => 'critical', 'name' => 'Critical', 'sla_minutes' => 4 * 60, 'color' => '#F44336', 'sort_order' => 40],
        ['code' => 'emergency', 'name' => 'Emergency', 'sla_minutes' => 60, 'color' => '#B71C1C', 'sort_order' => 50],
    ];

    public function run(): void
    {
        foreach (self::PRIORITIES as $row) {
            ReportPriority::query()->updateOrCreate(
                ['code' => $row['code']],
                $row + ['active' => true],
            );
        }
    }
}
