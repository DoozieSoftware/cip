<?php

declare(strict_types=1);

namespace App\Modules\Integrations\Models;

use Database\Factories\Modules\Integrations\Models\IntegrationFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * T-M12-007 — `integrations` row per `docs/12` §34.
 *
 * One row per external system the platform may call. The
 * `provider` column is the connector class identifier
 * (e.g. "gmc", "bbmp", "pgportal", "sms_gateway"). The
 * `credentials` column is JSON and the controller masks
 * the response before serialisation.
 *
 *  - `status` is one of: active | degraded | disabled
 *  - `last_check_at` / `last_error` are populated by the
 *    `/integrations/{id}/health` probe
 *  - `settings` is free-form per-provider config (timeout,
 *    retry_count, …)
 *
 * @property string $id
 * @property string $code
 * @property string $provider
 * @property string $display_name
 * @property string $base_url
 * @property array<string, mixed>|null $credentials
 * @property array<string, mixed>|null $settings
 * @property string $status
 * @property Carbon|null $last_check_at
 * @property string|null $last_error
 */
class Integration extends Model
{
    /**
     * @use HasFactory<IntegrationFactory>
     */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'integrations';

    public const STATUSES = ['active', 'degraded', 'disabled'];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'code',
        'provider',
        'display_name',
        'base_url',
        'credentials',
        'settings',
        'status',
        'last_check_at',
        'last_error',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'credentials' => 'array',
            'settings' => 'array',
            'last_check_at' => 'datetime',
        ];
    }
}
