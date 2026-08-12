<?php

declare(strict_types=1);

use App\Modules\Media\Services\MediaAuthorizationService;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Users\Models\User;
use Database\Seeders\ReportStatusesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;

uses(RefreshDatabase::class);

function mediaLifecycleRequest(User $user): Request
{
    $request = Request::create('/api/v1/reports/media/photos', 'POST');
    $request->setUserResolver(static fn (): User => $user);

    return $request;
}

beforeEach(function (): void {
    (new ReportStatusesSeeder)->run();
});

it('allows the report owner to append evidence only while the report is a draft', function (): void {
    $citizen = User::factory()->create();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();
    $submitted = ReportStatus::query()->where('code', 'submitted')->firstOrFail();
    $report = Report::factory()->create([
        'citizen_id' => $citizen->id,
        'current_status_id' => $draft->id,
    ]);
    $service = app(MediaAuthorizationService::class);

    expect($service->assertCanModifyMedia(mediaLifecycleRequest($citizen), $report->id))->toBeNull();

    $report->update(['current_status_id' => $submitted->id]);

    expect($service->assertCanModifyMedia(mediaLifecycleRequest($citizen), $report->id)?->getStatusCode())
        ->toBe(422);
});
