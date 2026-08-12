<?php

declare(strict_types=1);

use App\Modules\Reports\Http\Resources\ReportResource;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportMergeDispute;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Users\Models\User;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * P1-07 — citizen merge dispute regression tests.
 *
 * Verifies that a citizen can dispute an incorrect merge: the
 * report leaves the `merged` state, a dispute row is created,
 * and the citizen-facing resource reflects the change.
 */
beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
});

if (! function_exists('makeCitizen')) {
    function makeCitizen(): User
    {
        $u = User::factory()->create();
        $u->assignRole('citizen');

        return $u;
    }
}

function createMergedReport(User $citizen, User $canonicalCitizen): Report
{
    $mergedStatus = ReportStatus::query()->where('code', 'merged')->firstOrFail();
    $canonical = Report::factory()->create([
        'citizen_id' => $canonicalCitizen->id,
    ]);

    return Report::factory()->create([
        'citizen_id' => $citizen->id,
        'current_status_id' => $mergedStatus->id,
        'merged_into' => $canonical->id,
        'merged_at' => now(),
    ]);
}

it('allows a citizen to dispute an incorrect merge', function (): void {
    $citizen = makeCitizen();
    $canonicalCitizen = makeCitizen();
    $report = createMergedReport($citizen, $canonicalCitizen);

    $response = $this->actingAs($citizen)->postJson(
        "/api/v1/citizen/reports/{$report->id}/dispute-merge",
        ['reason' => 'This was merged incorrectly — different location.'],
    );

    $response->assertOk();

    $pendingModerator = ReportStatus::query()->where('code', 'pending_moderator')->firstOrFail();
    $fresh = $report->fresh();

    expect($fresh->current_status_id)->toBe($pendingModerator->id)
        ->and($fresh->merged_into)->toBeNull()
        ->and($fresh->merged_at)->toBeNull();

    // A dispute row was created.
    $dispute = ReportMergeDispute::query()->where('report_id', $report->id)->first();
    expect($dispute)->not->toBeNull()
        ->and($dispute->citizen_id)->toBe($citizen->id)
        ->and($dispute->reason)->toBe('This was merged incorrectly — different location.')
        ->and($dispute->status)->toBe('open');

    // Audit trail captured the dispute.
    $audit = AuditLog::query()->where('entity_id', $report->id)->where('action', 'report.citizen_dispute_merge')->first();
    expect($audit)->not->toBeNull();

    // The citizen-facing resource reflects the dispute.
    $resource = new ReportResource($fresh);
    $arr = $resource->toArray(request());
    expect($arr['merged_into'])->toBeNull()
        ->and($arr['canonical_report'])->toBeNull();
});

it('rejects a dispute from a non-owner citizen', function (): void {
    $owner = makeCitizen();
    $intruder = makeCitizen();
    $canonicalCitizen = makeCitizen();
    $report = createMergedReport($owner, $canonicalCitizen);

    $this->actingAs($intruder)->postJson(
        "/api/v1/citizen/reports/{$report->id}/dispute-merge",
        ['reason' => 'hax'],
    )->assertForbidden();
});

it('rejects a dispute on a report that is not merged', function (): void {
    $citizen = makeCitizen();
    $report = Report::factory()->create([
        'citizen_id' => $citizen->id,
    ]);

    $this->actingAs($citizen)->postJson(
        "/api/v1/citizen/reports/{$report->id}/dispute-merge",
        ['reason' => 'not merged'],
    )->assertStatus(422);
});

it('rejects a dispute without a reason', function (): void {
    $citizen = makeCitizen();
    $canonicalCitizen = makeCitizen();
    $report = createMergedReport($citizen, $canonicalCitizen);

    $this->actingAs($citizen)->postJson(
        "/api/v1/citizen/reports/{$report->id}/dispute-merge",
        ['reason' => ''],
    )->assertStatus(422);
});
