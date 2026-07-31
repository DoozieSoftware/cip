<?php

declare(strict_types=1);

use App\Modules\AI\Models\AiProviderConfig;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $projectId = $this->configString('ai.vertex.project_id');
        $location = $this->configString('ai.vertex.location') ?: 'global';
        $credentialsPath = $this->configString('ai.vertex.credentials_path');

        AiProviderConfig::query()->updateOrCreate(
            ['code' => 'vertex-gemini-flash'],
            [
                'driver' => 'openai_compatible',
                'name' => 'Vertex AI Gemini Flash',
                'base_url' => sprintf(
                    'https://aiplatform.googleapis.com/v1/projects/%s/locations/%s/endpoints/openapi',
                    $projectId,
                    $location,
                ),
                'auth_type' => 'oauth_service_account',
                'credentials' => $credentialsPath !== ''
                    ? ['service_account_path' => $credentialsPath]
                    : null,
                'extra_headers' => null,
                'model' => $this->configString('ai.vertex.model') ?: 'google/gemini-3.6-flash',
                'temperature' => 0.2,
                'timeout_ms' => 60000,
                'retry_count' => 2,
                'is_fallback' => false,
                'priority' => 5,
                'active' => $projectId !== '' && $credentialsPath !== '',
                'updated_at' => $now,
            ],
        );

        AiProviderConfig::query()
            ->where('code', 'gemini-flash')
            ->update([
                'active' => false,
                'is_fallback' => true,
                'priority' => 900,
                'updated_at' => $now,
            ]);
    }

    public function down(): void
    {
        AiProviderConfig::query()
            ->where('code', 'vertex-gemini-flash')
            ->update(['active' => false]);
    }

    private function configString(string $key): string
    {
        $value = config($key);

        return is_string($value) ? $value : '';
    }
};
