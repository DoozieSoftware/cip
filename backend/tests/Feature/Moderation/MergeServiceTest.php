<?php

declare(strict_types=1);

use App\Modules\Moderation\Events\ReportsMerged;
use App\Modules\Moderation\Services\ModerationService;
use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Security\Models\AuditLog;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

/**
 * ModerationService::merge bulk duplicate-folding.
 *
 * `merge()` keeps the canonical report unchanged and moves
 * every duplicate to the `merged` terminal state. Both the
 * canonical and the duplicate get an audit row, and the
 * `ReportsMerged` event fires once with the full list of
 * duplicate ids.
 */
beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
    Event::fake([ReportStatusChanged::class, ReportsMerged::class]);
});

if (! function_exists('makeModerator')) {
function mergeModerator(): User
{
    $u = User::factory()->create();
    $u->assignRole('moderator');

    return $u;
}
}

it('merges multiple duplicates into a canonical report', function (): void {
    $canonical = Report::factory()->create();
    $dup1 = Report::factory()->create();
    $dup2 = Report::factory()->create();
    $unrelated = Report::factory()->create();

    $moderator = mergeModerator();
    $service = app(ModerationService::class);

    $merged = $service->merge($canonical->id, [$dup1->id, $dup2->id], 'Same pothole', 'duplicate', $moderator);

    expect($merged)->toBe([$dup1->id, $dup2->id]);

    $mergedStatus = ReportStatus::query()->where('code', 'merged')->firstOrFail();
    expect($dup1->fresh()->current_status_id)->toBe($mergedStatus->id);
    expect($dup2->fresh()->current_status_id)->toBe($mergedStatus->id);

    // The unrelated report is untouched.
    expect($unrelated->fresh()->current_status_id)->not->toBe($mergedStatus->id);

    // Audit rows for each duplicate + a row for the canonical.
    $auditCount = AuditLog::query()->where('entity_id', $dup1->id)->where('action', 'report.merged')->count();
    expect($auditCount)->toBe(1);
    $auditCount2 = AuditLog::query()->where('entity_id', $dup2->id)->where('action', 'report.merged')->count();
    expect($auditCount2)->toBe(1);
    $canonAudit = AuditLog::query()->where('entity_id', $canonical->id)->where('action', 'report.canonical_for_merge')->count();
    expect($canonAudit)->toBe(1);

    Event::assertDispatched(ReportsMerged::class, fn (ReportsMerged $e): bool => $e->canonicalReportId === $canonical->id && $e->duplicateReportIds === [$dup1->id, $dup2->id]);
});

it('rejects an unknown canonical id with VALIDATION_FAILED', function (): void {
    $service = app(ModerationService::class);
    $service->merge('019f0000-0000-7000-8000-000000000000', ['dup-1'], null, null, mergeModerator());
})->throws(ApiException::class);

it('skips a duplicate id that does not exist', function (): void {
    $canonical = Report::factory()->create();
    $service = app(ModerationService::class);

    $merged = $service->merge($canonical->id, ['019f0000-0000-7000-8000-000000000001'], null, null, mergeModerator());
    expect($merged)->toBe([]);
});

it('skips a duplicate id that is the canonical itself', function (): void {
    $canonical = Report::factory()->create();
    $service = app(ModerationService::class);

    $merged = $service->merge($canonical->id, [$canonical->id], null, null, mergeModerator());
    expect($merged)->toBe([]);
});

it('rejects a non-moderator actor', function (): void {
    $canonical = Report::factory()->create();
    $service = app(ModerationService::class);
    $service->merge($canonical->id, ['x'], null, null, User::factory()->create());
})->throws(ApiException::class);

it('deduplicates a duplicate-id list', function (): void {
    $canonical = Report::factory()->create();
    $dup1 = Report::factory()->create();

    $service = app(ModerationService::class);
    $merged = $service->merge($canonical->id, [$dup1->id, $dup1->id, $dup1->id], null, null, mergeModerator());

    expect($merged)->toBe([$dup1->id]);
    $auditCount = AuditLog::query()->where('entity_id', $dup1->id)->where('action', 'report.merged')->count();
    expect($auditCount)->toBe(1);
});
