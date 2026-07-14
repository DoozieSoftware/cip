<?php

declare(strict_types=1);

use App\Modules\AI\Services\ImageQualityAnalyzer;
use App\Modules\Media\Models\Media;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

uses(TestCase::class);

it('flags a valid but featureless JPEG as unreliable evidence', function (): void {
    $image = imagecreatetruecolor(640, 480);
    $gray = imagecolorallocate($image, 210, 210, 210);
    imagefill($image, 0, 0, $gray);
    ob_start();
    imagejpeg($image, null, 90);
    $bytes = (string) ob_get_clean();

    Storage::fake('local');
    Storage::disk('local')->put('evidence/blank.jpg', $bytes);

    $media = new Media([
        'storage_disk' => 'local',
        'storage_path' => 'evidence/blank.jpg',
        'mime' => 'image/jpeg',
        'size' => strlen($bytes),
        'width' => 640,
        'height' => 480,
    ]);

    $analyzer = new ImageQualityAnalyzer;
    $score = $analyzer->score($media);

    expect($score)->toBeLessThan(ImageQualityAnalyzer::FLAG_THRESHOLD)
        ->and($analyzer->shouldFlagForModerator($score))->toBeTrue();
});
