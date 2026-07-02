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
 *  - `driver` is the type discriminator `AiProviderFactory`
 *    switches on (`mock` | `qwen_vl` | `openai_compatible`).
 *    Any number of rows can share a driver — e.g. two
 *    `openai_compatible` rows, one pointed at OpenRouter and
 *    one at a Modal.com-deployed endpoint.
 *  - `credentials` is an encrypted JSON blob (`{"api_key": "..."}`)
 *    decrypted only when `AiProviderFactory` builds the
 *    provider instance; the API resource never serialises it.
 *  - `extra_headers` is a JSON map of static headers a
 *    custom endpoint needs (e.g. OpenRouter's `HTTP-Referer`).
 *  - `temperature` is a decimal(3,2); 0.00–1.00
 *  - `timeout_ms` and `retry_count` control the HTTP
 *    client loop in OpenAICompatibleProvider (T-M8-009)
 *
 * @property string $id
 * @property string $code
 * @property string $driver
 * @property string $name
 * @property string $base_url
 * @property string $auth_type
 * @property array<string, mixed>|null $credentials
 * @property array<string, string>|null $extra_headers
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
        'code', 'driver', 'name', 'base_url', 'auth_type',
        'credentials', 'extra_headers', 'model', 'temperature',
        'timeout_ms', 'retry_count', 'is_fallback',
        'priority', 'active',
    ];

    protected $casts = [
        'credentials' => 'encrypted:array',
        'extra_headers' => 'array',
        'temperature' => 'float',
        'timeout_ms' => 'integer',
        'retry_count' => 'integer',
        'is_fallback' => 'boolean',
        'priority' => 'integer',
        'active' => 'boolean',
    ];
}
