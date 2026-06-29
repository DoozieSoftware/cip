<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Modules\AI\Events\AiCompleted;
use App\Modules\Departments\Models\Department;
use App\Modules\Notifications\Jobs\SendNotificationJob;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Reports\Events\ReportAssigned;
use App\Modules\Reports\Events\ReportStatusChanged;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Settings\Models\AppConfig;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);



beforeEach(function (): void {
    Bus::fake([SendNotificationJob::class]);
    (new RolesAndPermissionsSeeder)->run();
    Mail::fake();

    $dept = Department::factory()->create();
    AppConfig::query()->updateOrCreate(
        ['key' => 'routing_default_department_id'],
        [
            'value' => ['department_id' => $dept->id],
            'description' => 'Default department for unrouted reports (test seed)',
            'is_public' => false,
        ],
    );

    NotificationTemplate::query()->delete();
    $this->user = User::factory()->create(['email' => 'citizen@example.test']);

    foreach (['report.assigned', 'report.status_changed', 'ai.classified', 'security.alert'] as $code) {
        $tpl = new NotificationTemplate([
            'code' => $code,
            'name' => Str::title(str_replace('.', ' ', $code)),
            'channel' => 'email',
            'subject' => 'Subject',
            'body' => 'Body for {tracking_number}',
            'locale' => 'en',
            'version' => 1,
            'active' => true,
        ]);
        $tpl->id = (string) Str::uuid();
        $tpl->save();
    }
});

it('creates a report.assigned notification on ReportAssigned', function (): void {
    $report = makeReportWith($this->user);

    ReportAssigned::dispatch(
        reportId: $report->id,
        departmentId: (string) Str::uuid(),
        officerId: null,
        slaMinutes: 60,
    );

    $n = Notification::query()->where('type', 'report.assigned')->where('user_id', $this->user->id)->first();
    expect($n)->not->toBeNull()
        ->and($n->channel)->toBe('email')
        ->and($n->status)->toBe(Notification::STATUS_PENDING);
});

it('skips anonymous reports (no citizen_id)', function (): void {
    $report = makeReportWith(null);

    ReportAssigned::dispatch(
        reportId: $report->id,
        departmentId: (string) Str::uuid(),
        officerId: null,
        slaMinutes: 60,
    );

    expect(Notification::query()->where('type', 'report.assigned')->count())->toBe(0);
});

it('creates a report.status_changed notification on ReportStatusChanged', function (): void {
    $report = makeReportWith($this->user);
    $toStatus = ReportStatus::factory()->create();

    ReportStatusChanged::dispatch(
        reportId: $report->id,
        fromStatusId: null,
        toStatusId: $toStatus->id,
    );

    $n = Notification::query()->where('type', 'report.status_changed')->where('user_id', $this->user->id)->first();
    expect($n)->not->toBeNull()
        ->and($n->payload['variables']['report_id'])->toBe($report->id);
});

it('creates an ai.classified notification on AiCompleted', function (): void {
    $report = makeReportWith($this->user);

    AiCompleted::dispatch(
        reportId: $report->id,
        categoryCode: 'pothole',
        severityCode: 'medium',
        aiLabel: 'road.pothole',
        visionResult: ['confidence' => 0.97],
    );

    $n = Notification::query()->where('type', 'ai.classified')->where('user_id', $this->user->id)->first();
    expect($n)->not->toBeNull()
        ->and($n->payload['variables']['ai_label'])->toBe('road.pothole');
});

it('skips a missing report gracefully (no exception)', function (): void {
    ReportAssigned::dispatch(
        reportId: (string) Str::uuid(),
        departmentId: (string) Str::uuid(),
        officerId: null,
        slaMinutes: 60,
    );

    expect(Notification::query()->count())->toBe(0);
});

it('skips a missing user gracefully (citizen_id does not resolve)', function (): void {
    $stranger = User::factory()->create();
    $report = makeReportWith($stranger);
    $stranger->forceDelete();

    ReportAssigned::dispatch(
        reportId: $report->id,
        departmentId: (string) Str::uuid(),
        officerId: null,
        slaMinutes: 60,
    );

    expect(Notification::query()->where('type', 'report.assigned')->count())->toBe(0);
});

function makeReportWith(?User $citizen)
{
    return Report::factory()->create([
        'citizen_id' => $citizen?->id,
    ]);
}
