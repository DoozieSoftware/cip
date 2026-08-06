<?php

declare(strict_types=1);

use App\Modules\AI\Models\PromptVersion;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

function createPrompt(string $status = 'draft'): PromptVersion
{
    return PromptVersion::query()->create([
        'name' => 'category_classifier', 'version' => 1, 'purpose' => 'classify',
        'provider_code' => 'mock', 'prompt_text' => 'classify this',
        'expected_json_schema' => null, 'status' => $status,
    ]);
}

it('allows super_admin to approve a prompt', function (): void {
    Sanctum::actingAs(createSuperAdmin());
    $prompt = createPrompt('draft');

    $this->postJson('/api/v1/admin/ai/prompts/'.$prompt->id.'/approve')
        ->assertOk()
        ->assertJsonPath('data.status', 'approved');
});

it('allows super_admin to rollback a prompt', function (): void {
    Sanctum::actingAs(createSuperAdmin());
    $prompt = createPrompt('deprecated');

    $this->postJson('/api/v1/admin/ai/prompts/'.$prompt->id.'/rollback')
        ->assertOk()
        ->assertJsonPath('data.status', 'approved');
});

it('blocks a citizen from approving a prompt with 403', function (): void {
    Sanctum::actingAs(createCitizen());
    $prompt = createPrompt('draft');

    $this->postJson('/api/v1/admin/ai/prompts/'.$prompt->id.'/approve')
        ->assertStatus(403)
        ->assertJsonPath('code', 'FORBIDDEN');

    expect(PromptVersion::query()->find($prompt->id)->status)->toBe('draft');
});

it('blocks a citizen from rolling back a prompt with 403', function (): void {
    Sanctum::actingAs(createCitizen());
    $prompt = createPrompt('deprecated');

    $this->postJson('/api/v1/admin/ai/prompts/'.$prompt->id.'/rollback')
        ->assertStatus(403)
        ->assertJsonPath('code', 'FORBIDDEN');
});

it('blocks a moderator from approving a prompt with 403', function (): void {
    Sanctum::actingAs(createModerator());
    $prompt = createPrompt('draft');

    $this->postJson('/api/v1/admin/ai/prompts/'.$prompt->id.'/approve')
        ->assertStatus(403)
        ->assertJsonPath('code', 'FORBIDDEN');
});

it('blocks a moderator from rolling back a prompt with 403', function (): void {
    Sanctum::actingAs(createModerator());
    $prompt = createPrompt('deprecated');

    $this->postJson('/api/v1/admin/ai/prompts/'.$prompt->id.'/rollback')
        ->assertStatus(403)
        ->assertJsonPath('code', 'FORBIDDEN');
});

it('returns 401 for an unauthenticated caller on prompt approve', function (): void {
    $prompt = createPrompt('draft');

    $this->postJson('/api/v1/admin/ai/prompts/'.$prompt->id.'/approve')
        ->assertStatus(401)
        ->assertJsonPath('code', 'UNAUTHORIZED');
});

it('returns 401 for an unauthenticated caller on prompt rollback', function (): void {
    $prompt = createPrompt('deprecated');

    $this->postJson('/api/v1/admin/ai/prompts/'.$prompt->id.'/rollback')
        ->assertStatus(401)
        ->assertJsonPath('code', 'UNAUTHORIZED');
});

function createSuperAdmin(): User
{
    $user = User::factory()->create();
    $user->assignRole('super_admin');

    return $user;
}

function createCitizen(): User
{
    $user = User::factory()->create();
    $user->assignRole('citizen');

    return $user;
}

function createModerator(): User
{
    $user = User::factory()->create();
    $user->assignRole('moderator');

    return $user;
}
