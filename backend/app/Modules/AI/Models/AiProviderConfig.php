<?php

declare(strict_types=1);

namespace App\Modules\AI\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * `ai_provider_configs` row per docs/04 §10 and docs/10 §6.
 *
 * One row per AI provider the orchestrator can call. The
 * `is_fallback`, `priority`, and `active` columns together
 * let the AIProviderRegistry (T-M8-014) resolve a
 * (code, is_default) tuple in a single sorted query.
 *
 *  - `code` is the natural key (e.g. `openai`, `qwen-vl`,
 *    `anthropic`, `local-mock`); unique in the DB and
 *    referenced by `prompt_versions.provider_code` and
 *    `ai_jobs.provider_code`
 *  - `api_key_secret_id` is a UUID but does NOT have a FK
 *    to a `secrets` table — the secret store ships in a
 *    later milestone; for now the value is null and the
 *    provider service is responsible for fetching from
 *    env / config
 *  - `temperature` is a decimal(3,2); 0.00–1.00
 *  - `timeout_ms` and `retry_count` control the HTTP
 *    client loop in OpenAICompatibleProvider (T-M8-009)
 *
 * @property string $id
 * @property string $code
 * @property string $name
 * @property string $base_url
 * @property string $auth_type
 * @property string|null $api_key_secret_id
 * @property string $model
 * @property float $temperature
 * @property int $timeout_ms
 * @property int $retry_count
 * @property bool $is_fallback
 * @property int $priority
 * @property bool $active
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class AiProviderConfig extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'ai_provider_configs';

    protected $fillable = [
        'code', 'name', 'base_url', 'auth_type',
        'api_key_secret_id', 'model', 'temperature',
        'timeout_ms', 'retry_count', 'is_fallback',
        'priority', 'active',
    ];

    protected $casts = [
        'temperature' => 'float',
        'timeout_ms' => 'integer',
        'retry_count' => 'integer',
        'is_fallback' => 'boolean',
        'priority' => 'integer',
        'active' => 'boolean',
    ];
}
