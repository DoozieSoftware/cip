<?php

declare(strict_types=1);

namespace App\Modules\Settings\Models;

use Database\Factories\Modules\Settings\Models\AppConfigFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Feature-flag row per docs/04 §18 and docs/09 §18.
 *
 *  - `enabled` is the master kill-switch.
 *  - `rollout_percentage` (0-100) is the deterministic-hash
 *    bucket size (FeatureFlagService in T-M3-013).
 *  - `cohort` is a JSON array of predicate objects; the user
 *    matches if every key/value in any predicate matches
 *    the user's data.
 *  - `value` is the JSON payload that the application reads
 *    when the flag is on (e.g. {"providers":["openai","local"]}).
 *
 * @property string $id
 * @property string $key
 * @property mixed $value
 * @property bool $enabled
 * @property int $rollout_percentage
 * @property array<int, array<string, mixed>>|null $cohort
 * @property string|null $description
 */
class AppConfig extends Model
{
    /**
     * @use HasFactory<AppConfigFactory>
     */
    use HasFactory;

    use HasUuids;

    protected $table = 'app_configs';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'key',
        'value',
        'enabled',
        'rollout_percentage',
        'cohort',
        'description',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'value' => 'array',
            'enabled' => 'boolean',
            'cohort' => 'array',
            'rollout_percentage' => 'integer',
        ];
    }
}
