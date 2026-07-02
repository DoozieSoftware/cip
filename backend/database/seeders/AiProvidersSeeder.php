<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\AI\Models\AiProviderConfig;
use Illuminate\Database\Seeder;

/**
 * Seeds the default AI provider set per docs/10 §7:
 *  - `mock` is the highest-priority active provider in dev/test
 *    so the orchestrator never makes a real network call unless
 *    a Super Admin disables it
 *  - `qwen-vl` is present but inactive until a Super Admin
 *    configures the secret and flips the `active` flag
 *  - `openai` is also present but inactive
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
                'code' => 'mock',
                'driver' => 'mock',
                'name' => 'Mock provider (dev/test)',
                'base_url' => 'http://localhost',
                'auth_type' => 'none',
                'credentials' => null,
                'model' => 'mock-1.0',
                'temperature' => 0.2,
                'timeout_ms' => 5000,
                'retry_count' => 1,
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
