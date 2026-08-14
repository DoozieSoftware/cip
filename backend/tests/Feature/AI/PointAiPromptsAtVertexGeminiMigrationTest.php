<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function insertPrompt(string $name, int $version, string $providerCode, string $status): void
{
    DB::table('prompt_versions')->insert([
        'id' => (string) Str::uuid(),
        'name' => $name,
        'version' => $version,
        'provider_code' => $providerCode,
        'prompt_text' => 'Test prompt for '.$name,
        'status' => $status,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

it('points approved proof and classifier prompts back at Vertex Gemini after drifting to Modal', function (): void {
    insertPrompt('proof_verification', 1, 'modal-vision', 'approved');
    insertPrompt('category_classifier', 4, 'modal-vision', 'approved');
    insertPrompt('severity_estimator', 1, 'modal-vision', 'approved');

    /** @var Migration $migration */
    $migration = require database_path('migrations/2026_08_14_000000_point_ai_prompts_at_vertex_gemini.php');
    /** @phpstan-ignore-next-line method.notFound */
    $migration->up();

    expect(DB::table('prompt_versions')->where('name', 'proof_verification')->where('status', 'approved')->value('provider_code'))
        ->toBe('vertex-gemini-flash')
        ->and(DB::table('prompt_versions')->where('name', 'category_classifier')->where('status', 'approved')->value('provider_code'))
        ->toBe('vertex-gemini-flash')
        ->and(DB::table('prompt_versions')->where('name', 'severity_estimator')->where('status', 'approved')->value('provider_code'))
        ->toBe('modal-vision');
});

it('leaves non-approved prompt versions untouched', function (): void {
    insertPrompt('proof_verification', 1, 'modal-vision', 'deprecated');

    /** @var Migration $migration */
    $migration = require database_path('migrations/2026_08_14_000000_point_ai_prompts_at_vertex_gemini.php');
    /** @phpstan-ignore-next-line method.notFound */
    $migration->up();

    expect(DB::table('prompt_versions')->where('name', 'proof_verification')->where('status', 'deprecated')->value('provider_code'))
        ->toBe('modal-vision');
});
