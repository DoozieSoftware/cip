<?php

declare(strict_types=1);

use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaHash;
use App\Modules\Reports\Events\ReportEvidenceReady;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Users\Models\User;
use Database\Seeders\DefaultWorkflowSeeder;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new DefaultWorkflowSeeder)->run();
    Storage::fake('local');
});

it('keeps a newly created report in draft until evidence is ready', function (): void {
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);
    $type = ReportType::query()->where('requires_photo', true)->firstOrFail();

    $response = $this->postJson('/api/v1/reports', [
        'report_type_id' => $type->id,
        'title' => 'Pothole on MG Road',
        'description' => 'A large pothole near the signal.',
        'latitude' => 12.9716,
        'longitude' => 77.5946,
    ])->assertCreated();

    expect($response->json('data.status.code'))->toBe('draft');
    $report = Report::query()->findOrFail($response->json('data.id'));

    $this->postJson("/api/v1/reports/{$report->id}/finalize")
        ->assertStatus(409)
        ->assertJsonPath('code', 'EVIDENCE_NOT_READY')
        ->assertJsonPath('errors.required.photo_count', 1);

    expect($report->refresh()->status?->code)->toBe('draft');
});

it('finalizes an idempotent report only after durable hashed evidence', function (): void {
    Event::fake([ReportEvidenceReady::class]);
    $citizen = User::factory()->create();
    Sanctum::actingAs($citizen);
    $type = ReportType::query()->where('requires_photo', true)->firstOrFail();
    $draft = ReportStatus::query()->where('code', 'draft')->firstOrFail();

    $idempotencyKey = 'report-submission-with-evidence';
    $response = $this->withHeader('Idempotency-Key', $idempotencyKey)->postJson('/api/v1/reports', [
        'report_type_id' => $type->id,
        'title' => 'Pothole on MG Road',
        'description' => 'A large pothole near the signal.',
        'latitude' => 12.9716,
        'longitude' => 77.5946,
    ])->assertCreated();
    $report = Report::query()->findOrFail($response->json('data.id'));

    $path = "evidence/{$report->id}/photo/evidence.jpg";
    Storage::disk('local')->put($path, 'image bytes');
    $sha = hash('sha256', 'image bytes');
    $media = Media::query()->create([
        'report_id' => $report->id,
        'type' => 'PHOTO',
        'role' => 'evidence',
        'storage_disk' => 'local',
        'storage_path' => $path,
        'mime' => 'image/jpeg',
        'size' => 11,
        'checksum' => $sha,
        'uploaded_at' => now(),
        'uploaded_by' => $citizen->id,
        'version' => 1,
        'is_replaced' => false,
    ]);
    MediaHash::query()->create([
        'media_id' => $media->id,
        'sha256' => $sha,
        'sha512' => hash('sha512', 'image bytes'),
        'perceptual_hash' => str_repeat('a', 16),
        'created_at' => now(),
    ]);

    $first = $this->withHeader('Idempotency-Key', $idempotencyKey)
        ->postJson("/api/v1/reports/{$report->id}/finalize")
        ->assertOk();
    expect($first->json('data.status.code'))->toBeIn(['submitted', 'ai_processing']);
    Event::assertDispatched(ReportEvidenceReady::class);

    $second = $this->withHeader('Idempotency-Key', $idempotencyKey)
        ->postJson("/api/v1/reports/{$report->id}/finalize")
        ->assertOk();
    expect($second->json('data.id'))->toBe($first->json('data.id'));
});
