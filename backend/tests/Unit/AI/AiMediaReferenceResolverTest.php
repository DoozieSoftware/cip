<?php

declare(strict_types=1);

use App\Modules\AI\Services\AiMediaReferenceResolver;
use App\Modules\Media\Models\Media;
use App\Modules\Media\Support\MediaUrl;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

uses(TestCase::class);

it('embeds local evidence bytes instead of exposing an unreachable localhost URL', function (): void {
    Storage::fake('local');
    Storage::disk('local')->put('evidence/report/photo.jpg', 'image-bytes');

    $media = new Media([
        'storage_disk' => 'local',
        'storage_path' => 'evidence/report/photo.jpg',
        'mime' => 'image/jpeg',
    ]);
    $media->id = 'media-id';

    $reference = (new AiMediaReferenceResolver(new MediaUrl))->resolve($media);

    expect($reference)->toBe('data:image/jpeg;base64,'.base64_encode('image-bytes'))
        ->and($reference)->not->toContain('localhost');
});
