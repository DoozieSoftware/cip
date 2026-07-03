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
 *    The `credentials.api_key` is populated from
 *    `AI_MODAL_API_KEY` at seed time, or left null for the admin
 *    to configure via the portal.
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

        $providers = [
            [
                'code' => 'modal-vision',
                'driver' => 'openai_compatible',
                'name' => 'Modal Vision (vLLM)',
                'base_url' => env('AI_MODAL_BASE_URL', 'https://akshayjoshi999--cpr-chatbot-vllm-serve.modal.run'),
                'auth_type' => 'bearer',
                'credentials' => env('AI_MODAL_API_KEY') !== null
                    ? ['api_key' => env('AI_MODAL_API_KEY')]
                    : null,
                'model' => env('AI_MODAL_MODEL', 'Qwen/Qwen2.5-VL-7B-Instruct'),
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
}
