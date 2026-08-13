<?php

declare(strict_types=1);

use App\Modules\Media\Contracts\VirusScanServiceInterface;
use App\Modules\Media\Enums\MediaQuarantineReason;
use App\Modules\Media\Enums\MediaQuarantineStatus;
use App\Modules\Media\Enums\MediaScanStatus;
use App\Modules\Media\Jobs\ComputeHashesJob;
use App\Modules\Media\Jobs\ExtractVideoMetadataJob;
use App\Modules\Media\Jobs\GenerateThumbnailJob;
use App\Modules\Media\Jobs\RecoverQuarantinedMediaJob;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Models\MediaAccessLog;
use App\Modules\Media\Services\MediaDeliveryService;
use App\Modules\Media\Services\MediaService;
use App\Modules\Media\Services\MimeValidator;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Services\EvidenceManifestService;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

uses(RefreshDatabase::class);

const MQR_TINY_JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z';

function mqrJpeg(): UploadedFile
{
    $temporary = tempnam(sys_get_temp_dir(), 'cip-mqr-');
    $path = $temporary.'.jpg';
    rename($temporary, $path);
    file_put_contents($path, base64_decode(MQR_TINY_JPEG));

    return new UploadedFile($path, 'evidence.jpg', 'image/jpeg', null, true);
}

function mqrScanner(callable $scan): VirusScanServiceInterface
{
    return new class($scan) implements VirusScanServiceInterface
    {
        public function __construct(private readonly mixed $callback) {}

        public function scan(string $path): bool
        {
            return (bool) ($this->callback)($path);
        }

        public function name(): string
        {
            return 'test-scanner';
        }

        public function healthCheck(): bool
        {
            return true;
        }
    };
}

beforeEach(function (): void {
    Storage::fake('local');
    config([
        'cip.media.disk' => 'local',
        'cip.media.quarantine.rescan_stale_seconds' => 60,
    ]);
});

it('releases only clean digest-verified bytes and records scanner custody', function (): void {
    Bus::fake([ComputeHashesJob::class, GenerateThumbnailJob::class, ExtractVideoMetadataJob::class]);
    $report = Report::factory()->create();
    $uploader = User::factory()->create();
    $service = new MediaService(app(MimeValidator::class), mqrScanner(fn (): bool => true));

    $media = $service->uploadPhoto($report->id, mqrJpeg(), $uploader->id);
    $quarantine = $media->quarantine()->firstOrFail();

    expect($media->scan_status)->toBe(MediaScanStatus::CLEAN)
        ->and($media->storage_path)->toStartWith("evidence/{$report->id}/photo/")
        ->and(Storage::disk('local')->exists($media->storage_path))->toBeTrue()
        ->and(Storage::disk('local')->exists("quarantine/{$report->id}/photo/{$media->id}.jpg"))->toBeFalse()
        ->and($quarantine->status)->toBe(MediaQuarantineStatus::RELEASED)
        ->and($quarantine->original_sha256)->toBe(hash('sha256', base64_decode(MQR_TINY_JPEG)))
        ->and(MediaAccessLog::query()->where('media_id', $media->id)->where('event', 'VIRUS_SCAN')->count())->toBe(1);

    Bus::assertDispatched(ComputeHashesJob::class);
    Bus::assertDispatched(GenerateThumbnailJob::class);
});

it('keeps infected uploads isolated and never queues post-processing', function (): void {
    Bus::fake([ComputeHashesJob::class, GenerateThumbnailJob::class, ExtractVideoMetadataJob::class]);
    $report = Report::factory()->create();
    $uploader = User::factory()->create();
    $service = new MediaService(app(MimeValidator::class), mqrScanner(fn (): bool => false));

    try {
        $service->uploadPhoto($report->id, mqrJpeg(), $uploader->id);
        $this->fail('Expected the infected upload to be rejected.');
    } catch (ApiException $e) {
        expect($e->errorCode)->toBe('MEDIA_INFECTED')
            ->and($e->httpStatus)->toBe(422);
    }

    $media = Media::query()->where('report_id', $report->id)->firstOrFail();
    $quarantine = $media->quarantine()->firstOrFail();

    expect($media->scan_status)->toBe(MediaScanStatus::INFECTED)
        ->and($media->storage_path)->toStartWith("quarantine/{$report->id}/photo/")
        ->and(Storage::disk('local')->exists($media->storage_path))->toBeTrue()
        ->and($quarantine->status)->toBe(MediaQuarantineStatus::CONFIRMED_INFECTED)
        ->and($quarantine->reason)->toBe(MediaQuarantineReason::INFECTED)
        ->and(app(EvidenceManifestService::class)->manifest($report)['ready'])->toBeFalse();

    Bus::assertNotDispatched(ComputeHashesJob::class);
    Bus::assertNotDispatched(GenerateThumbnailJob::class);
});

it('retains scanner infrastructure failures and safely releases them on recovery', function (): void {
    Bus::fake([ComputeHashesJob::class, GenerateThumbnailJob::class, ExtractVideoMetadataJob::class]);
    $report = Report::factory()->create();
    $uploader = User::factory()->create();
    $failing = new MediaService(
        app(MimeValidator::class),
        mqrScanner(fn (): never => throw new RuntimeException('scanner socket unavailable')),
    );

    try {
        $failing->uploadPhoto($report->id, mqrJpeg(), $uploader->id);
        $this->fail('Expected the scanner infrastructure failure.');
    } catch (ApiException $e) {
        expect($e->errorCode)->toBe('MEDIA_SCAN_UNAVAILABLE')
            ->and($e->httpStatus)->toBe(503)
            ->and($e->details['retryable'])->toBeTrue();
    }

    $media = Media::query()->where('report_id', $report->id)->firstOrFail();
    $quarantine = $media->quarantine()->firstOrFail();

    expect($media->scan_status)->toBe(MediaScanStatus::UNKNOWN)
        ->and($quarantine->status)->toBe(MediaQuarantineStatus::PENDING_RESCAN)
        ->and($quarantine->reason)->toBe(MediaQuarantineReason::SCANNER_ERROR)
        ->and(Storage::disk('local')->exists($media->storage_path))->toBeTrue();

    $this->app->instance(VirusScanServiceInterface::class, mqrScanner(fn (): bool => true));
    RecoverQuarantinedMediaJob::dispatchSync($quarantine->id);

    expect($media->refresh()->scan_status)->toBe(MediaScanStatus::CLEAN)
        ->and($media->storage_path)->toStartWith("evidence/{$report->id}/photo/")
        ->and($quarantine->refresh()->status)->toBe(MediaQuarantineStatus::RELEASED)
        ->and($quarantine->scan_attempts)->toBe(2)
        ->and(Storage::disk('local')->exists($media->storage_path))->toBeTrue();
});

it('never releases a quarantined object whose bytes changed before recovery', function (): void {
    $report = Report::factory()->create();
    $uploader = User::factory()->create();
    $failing = new MediaService(
        app(MimeValidator::class),
        mqrScanner(fn (): never => throw new RuntimeException('scanner unavailable')),
    );

    try {
        $failing->uploadPhoto($report->id, mqrJpeg(), $uploader->id);
    } catch (ApiException) {
        // Expected; the upload is retained for recovery.
    }

    $media = Media::query()->where('report_id', $report->id)->firstOrFail();
    $quarantine = $media->quarantine()->firstOrFail();
    Storage::disk('local')->put($media->storage_path, 'tampered bytes');
    $this->app->instance(VirusScanServiceInterface::class, mqrScanner(fn (): bool => true));

    RecoverQuarantinedMediaJob::dispatchSync($quarantine->id);

    expect($media->refresh()->scan_status)->toBe(MediaScanStatus::UNKNOWN)
        ->and($media->storage_path)->toStartWith('quarantine/')
        ->and($quarantine->refresh()->status)->toBe(MediaQuarantineStatus::INTEGRITY_FAILED)
        ->and($quarantine->reason)->toBe(MediaQuarantineReason::INTEGRITY_MISMATCH)
        ->and(Storage::disk('local')->exists($media->storage_path))->toBeTrue();
});

it('blocks list and delivery for quarantined media', function (): void {
    $report = Report::factory()->create();
    $media = Media::factory()->create([
        'report_id' => $report->id,
        'scan_status' => MediaScanStatus::UNKNOWN,
        'storage_path' => 'quarantine/report/photo/blocked.jpg',
    ]);
    Storage::disk('local')->put($media->storage_path, 'isolated');

    $this->getJson("/api/v1/media/{$media->id}/serve")
        ->assertStatus(403);

    // Use the service directly because the signed route middleware rejects an
    // unsigned URL before delivery; the delivery boundary must also reject it.
    $response = app(MediaDeliveryService::class)->serve($media->id);
    expect($response->getStatusCode())->toBe(409);
});
