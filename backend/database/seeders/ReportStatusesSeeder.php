<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Reports\Models\ReportStatus;
use Illuminate\Database\Seeder;

/**
 * Seeds the 11 report lifecycle states from docs/02 §7:
 *   Draft, Submitted, AI Processing, Pending Moderator, Assigned,
 *   Accepted, In Progress, Resolved, Verified, Closed, Rejected.
 *
 * Idempotent: `updateOrCreate` on `code`. Re-running is a no-op.
 */
class ReportStatusesSeeder extends Seeder
{
    /**
     * @var list<array<string, mixed>>
     */
    private const STATUSES = [
        ['code' => 'draft', 'name' => 'Draft', 'color' => '#9E9E9E', 'is_terminal' => false, 'sort_order' => 10],
        ['code' => 'submitted', 'name' => 'Submitted', 'color' => '#2196F3', 'is_terminal' => false, 'sort_order' => 20],
        ['code' => 'ai_processing', 'name' => 'AI Processing', 'color' => '#9C27B0', 'is_terminal' => false, 'sort_order' => 30],
        ['code' => 'pending_moderator', 'name' => 'Pending Moderator', 'color' => '#FF9800', 'is_terminal' => false, 'sort_order' => 40],
        ['code' => 'assigned', 'name' => 'Assigned', 'color' => '#3F51B5', 'is_terminal' => false, 'sort_order' => 50],
        ['code' => 'accepted', 'name' => 'Accepted', 'color' => '#1976D2', 'is_terminal' => false, 'sort_order' => 60],
        ['code' => 'in_progress', 'name' => 'In Progress', 'color' => '#03A9F4', 'is_terminal' => false, 'sort_order' => 70],
        ['code' => 'resolved', 'name' => 'Resolved', 'color' => '#4CAF50', 'is_terminal' => false, 'sort_order' => 80],
        ['code' => 'verified', 'name' => 'Verified', 'color' => '#1B5E20', 'is_terminal' => true, 'sort_order' => 90],
        ['code' => 'closed', 'name' => 'Closed', 'color' => '#212121', 'is_terminal' => true, 'sort_order' => 100],
        ['code' => 'rejected', 'name' => 'Rejected', 'color' => '#F44336', 'is_terminal' => true, 'sort_order' => 110],
        ['code' => 'merged',            'name' => 'Merged',            'color' => '#7B1FA2', 'is_terminal' => true,  'sort_order' => 120],
        ['code' => 'escalated',         'name' => 'Escalated',         'color' => '#E91E63', 'is_terminal' => false, 'sort_order' => 130],
    ];

    public function run(): void
    {
        foreach (self::STATUSES as $row) {
            ReportStatus::query()->updateOrCreate(
                ['code' => $row['code']],
                $row + ['description' => null, 'active' => true],
            );
        }
    }
}
