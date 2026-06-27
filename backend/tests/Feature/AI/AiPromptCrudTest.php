<?php

declare(strict_types=1);

use App\Modules\AI\Models\PromptVersion;
use App\Modules\Users\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
});

function superAdminUser(): User
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin;
}

it('GET /admin/ai/prompts returns a paginated list', function (): void {
    Sanctum::actingAs(superAdminUser());
    PromptVersion::query()->create([
        'name' => 'a', 'version' => 1, 'purpose' => null, 'provider_code' => 'mock',
        'prompt_text' => 'x', 'expected_json_schema' => null, 'status' => 'approved',
    ]);

    $this->getJson('/api/v1/admin/ai/prompts')
        ->assertOk()
        ->assertJsonStructure(['data' => [['id', 'name', 'version', 'status']]]);
});

it('POST /admin/ai/prompts creates a new prompt version', function (): void {
    Sanctum::actingAs(superAdminUser());

    $this->postJson('/api/v1/admin/ai/prompts', [
        'name' => 'category_classifier',
        'version' => 1,
        'purpose' => 'classify',
        'provider_code' => 'mock',
        'prompt_text' => 'classify this',
        'expected_json_schema' => ['type' => 'object'],
        'status' => 'draft',
    ])->assertCreated()
        ->assertJsonPath('data.name', 'category_classifier')->assertJsonPath('data.version', 1)->assertJsonPath('data.status', 'draft');
});

it('PUT /admin/ai/prompts/{id} updates the prompt', function (): void {
    Sanctum::actingAs(superAdminUser());
    $p = PromptVersion::query()->create([
        'name' => 'b', 'version' => 1, 'purpose' => null, 'provider_code' => 'mock',
        'prompt_text' => 'x', 'expected_json_schema' => null, 'status' => 'draft',
    ]);

    $this->putJson('/api/v1/admin/ai/prompts/'.$p->id, ['purpose' => 'updated'])
        ->assertOk()
        ->assertJsonPath('data.purpose', 'updated');
});

it('DELETE /admin/ai/prompts/{id} removes the prompt', function (): void {
    Sanctum::actingAs(superAdminUser());
    $p = PromptVersion::query()->create([
        'name' => 'c', 'version' => 1, 'purpose' => null, 'provider_code' => 'mock',
        'prompt_text' => 'x', 'expected_json_schema' => null, 'status' => 'draft',
    ]);

    $this->deleteJson('/api/v1/admin/ai/prompts/'.$p->id)
        ->assertOk()
        ->assertJson(['status' => 'deleted']);

    expect(PromptVersion::query()->find($p->id))->toBeNull();
});

it('POST /admin/ai/prompts/{id}/approve flips the new row to approved and deprecates the previous', function (): void {
    Sanctum::actingAs(superAdminUser());
    $old = PromptVersion::query()->create([
        'name' => 'd', 'version' => 1, 'purpose' => null, 'provider_code' => 'mock',
        'prompt_text' => 'v1', 'expected_json_schema' => null, 'status' => 'approved',
    ]);
    $new = PromptVersion::query()->create([
        'name' => 'd', 'version' => 2, 'purpose' => null, 'provider_code' => 'mock',
        'prompt_text' => 'v2', 'expected_json_schema' => null, 'status' => 'draft',
    ]);

    $this->postJson('/api/v1/admin/ai/prompts/'.$new->id.'/approve')
        ->assertOk()
        ->assertJsonPath('data.status', 'approved');

    expect(PromptVersion::query()->find($old->id)->status)->toBe('deprecated')
        ->and(PromptVersion::query()->find($new->id)->status)->toBe('approved');
});

it('POST /admin/ai/prompts/{id}/rollback flips the deprecated row back to approved', function (): void {
    Sanctum::actingAs(superAdminUser());
    $v1 = PromptVersion::query()->create([
        'name' => 'e', 'version' => 1, 'purpose' => null, 'provider_code' => 'mock',
        'prompt_text' => 'v1', 'expected_json_schema' => null, 'status' => 'deprecated',
    ]);
    $v2 = PromptVersion::query()->create([
        'name' => 'e', 'version' => 2, 'purpose' => null, 'provider_code' => 'mock',
        'prompt_text' => 'v2', 'expected_json_schema' => null, 'status' => 'approved',
    ]);

    $this->postJson('/api/v1/admin/ai/prompts/'.$v1->id.'/rollback')
        ->assertOk()
        ->assertJsonPath('data.status', 'approved');

    expect(PromptVersion::query()->find($v1->id)->status)->toBe('approved')
        ->and(PromptVersion::query()->find($v2->id)->status)->toBe('deprecated');
});

it('rollback rejects a target that is not deprecated (422)', function (): void {
    Sanctum::actingAs(superAdminUser());
    $p = PromptVersion::query()->create([
        'name' => 'f', 'version' => 1, 'purpose' => null, 'provider_code' => 'mock',
        'prompt_text' => 'x', 'expected_json_schema' => null, 'status' => 'draft',
    ]);

    $this->postJson('/api/v1/admin/ai/prompts/'.$p->id.'/rollback')
        ->assertStatus(422);
});
