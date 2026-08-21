<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Reports\Models\ReportStatus;
use Illuminate\Database\Seeder;

/**
 * Seeds the 15 report lifecycle states from docs/02 §7 + M10 moderation (merged, escalated)
 * + citizen verification (resolved_pending_verification, reopened):
 *   Pending for Submission, Submitted, AI Processing, Pending Moderator, Assigned,
 *   Accepted, In Progress, Resolved, Resolved — Pending Verification,
 *   Verified, Reopened, Resolved (closed), Rejected, Merged, Escalated.
 *
 * Display names for `draft` ("Pending for Submission") and `closed`
 * ("Resolved") follow decision D6/D8 — the previous "Draft"/"Closed"
 * names leaked into emails and audit text. Codes are unchanged.
 *
 * Idempotent: `updateOrCreate` on `code`. Re-running is a no-op.
 */
class ReportStatusesSeeder extends Seeder
{
    /**
     * @var list<array<string, mixed>>
     */
    private const STATUSES = [
        ['code' => 'draft',                        'name' => 'Pending for Submission',       'color' => '#9E9E9E', 'is_terminal' => false, 'sort_order' => 10],
        ['code' => 'submitted',                    'name' => 'Submitted',                    'color' => '#2196F3', 'is_terminal' => false, 'sort_order' => 20],
        ['code' => 'ai_processing',                'name' => 'AI Processing',                'color' => '#9C27B0', 'is_terminal' => false, 'sort_order' => 30],
        ['code' => 'pending_moderator',            'name' => 'Pending Moderator',            'color' => '#FF9800', 'is_terminal' => false, 'sort_order' => 40],
        ['code' => 'assigned',                     'name' => 'Assigned',                     'color' => '#3F51B5', 'is_terminal' => false, 'sort_order' => 50],
        ['code' => 'accepted',                     'name' => 'Accepted',                     'color' => '#1976D2', 'is_terminal' => false, 'sort_order' => 60],
        ['code' => 'in_progress',                  'name' => 'In Progress',                  'color' => '#03A9F4', 'is_terminal' => false, 'sort_order' => 70],
        ['code' => 'resolved',                     'name' => 'Resolved',                     'color' => '#4CAF50', 'is_terminal' => false, 'sort_order' => 75],
        ['code' => 'resolved_pending_verification', 'name' => 'Resolved — Pending Verification', 'color' => '#66BB6A', 'is_terminal' => false, 'sort_order' => 80],
        ['code' => 'verified',                     'name' => 'Verified',                     'color' => '#1B5E20', 'is_terminal' => true,  'sort_order' => 85],
        ['code' => 'reopened',                     'name' => 'Reopened',                     'color' => '#FF7043', 'is_terminal' => false, 'sort_order' => 87],
        ['code' => 'closed',                       'name' => 'Resolved',                     'color' => '#212121', 'is_terminal' => true,  'sort_order' => 90],
        ['code' => 'rejected',                     'name' => 'Rejected',                     'color' => '#F44336', 'is_terminal' => true,  'sort_order' => 100],
        ['code' => 'merged',                       'name' => 'Merged',                       'color' => '#7B1FA2', 'is_terminal' => true,  'sort_order' => 110],
        ['code' => 'escalated',                    'name' => 'Escalated',                    'color' => '#E91E63', 'is_terminal' => false, 'sort_order' => 120],
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
