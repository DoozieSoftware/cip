<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\AI\Models\AiProviderConfig;
use Illuminate\Database\Seeder;

/**
 * Seeds the default AI provider set per docs/10 §7:
 *  - `modal-vision` is the highest-priority active provider in
 *    pilot — it points at a Modal.com-hosted vLLM endpoint
 *    serving a vision-capable model (e.g. Qwen2.5-VL-7B-Instruct).
 *    Modal.com proxy auth uses `Modal-Key`/`Modal-Secret` headers
 *    (not a Bearer token), so those are populated from
 *    `AI_MODAL_KEY`/`AI_MODAL_SECRET` at seed time into
 *    `extra_headers`. `credentials.api_key` is left null because
 *    the OpenAICompatibleProvider's `withToken()` call would
 *    otherwise send an empty `Authorization: Bearer` header that
 *    some Modal gateways reject.
 *  - `qwen-vl` is present but inactive (DashScope direct).
 *  - `openai` is also present but inactive.
 *
 * Idempotent: each (code) is unique and we use updateOrCreate.
 */
class AiProvidersSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $geminiKey = $this->configString('ai.gemini.key');
        $modalKey = $this->configString('ai.modal.key');
        $modalSecret = $this->configString('ai.modal.secret');

        $providers = [
            [
                'code' => 'gemini-flash',
                'driver' => 'openai_compatible',
                'name' => 'Google Gemini Flash',
                'base_url' => $this->configString('ai.gemini.base_url'),
                'auth_type' => 'bearer',
                'credentials' => $this->nonEmptyMap(['api_key' => $geminiKey]),
                'model' => $this->configString('ai.gemini.model'),
                'temperature' => 0.2,
                'timeout_ms' => 60000,
                'retry_count' => 2,
                'is_fallback' => false,
                'priority' => 5,
                'active' => true,
            ],
            [
                'code' => 'modal-vision',
                'driver' => 'openai_compatible',
                'name' => 'Modal Vision (vLLM)',
                'base_url' => $this->configString('ai.modal.base_url'),
                'auth_type' => 'header',
                'credentials' => null,
                'extra_headers' => $this->nonEmptyMap([
                    'Modal-Key' => $modalKey,
                    'Modal-Secret' => $modalSecret,
                ]),
                'model' => $this->configString('ai.modal.model'),
                'temperature' => 0.2,
                'timeout_ms' => 60000,
                'retry_count' => 2,
                'is_fallback' => false,
                'priority' => 10,
                'active' => true,
            ],
            [
                'code' => 'openai',
                'driver' => 'openai_compatible',
                'name' => 'OpenAI (gpt-4o)',
                'base_url' => 'https://api.openai.com',
                'auth_type' => 'bearer',
                'credentials' => null,
                'model' => 'gpt-4o',
                'temperature' => 0.2,
                'timeout_ms' => 30000,
                'retry_count' => 2,
                'is_fallback' => false,
                'priority' => 20,
                'active' => false,
            ],
            [
                'code' => 'qwen-vl',
                'driver' => 'qwen_vl',
                'name' => 'Qwen-VL (DashScope)',
                'base_url' => 'https://dashscope.aliyuncs.com',
                'auth_type' => 'bearer',
                'credentials' => null,
                'model' => 'qwen-vl-plus',
                'temperature' => 0.2,
                'timeout_ms' => 30000,
                'retry_count' => 2,
                'is_fallback' => true,
                'priority' => 100,
                'active' => false,
            ],
        ];

        foreach ($providers as $p) {
            AiProviderConfig::query()->updateOrCreate(
                ['code' => $p['code']],
                array_merge($p, ['updated_at' => $now, 'created_at' => $now]),
            );
        }
    }

    private function configString(string $key): string
    {
        $value = config($key);

        return is_string($value) ? $value : '';
    }

    /**
     * @param  array<string, string>  $values
     * @return array<string, string>|null
     */
    private function nonEmptyMap(array $values): ?array
    {
        $filtered = array_filter($values, static fn (string $value): bool => $value !== '');

        return $filtered === [] ? null : $filtered;
    }
}
