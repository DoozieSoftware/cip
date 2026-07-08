<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use Database\Factories\Modules\Notifications\Models\NotificationChannelConfigFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * T-M12-009 — `notification_channel_configs` row per
 * `docs/09` §16.
 *
 * One row per channel credential bundle (mail, push, sms,
 * webhook). The Super Admin screen edits these at runtime;
 * the dispatcher reads them at send time.
 *
 *  - `channel` is one of: mail | push | sms | webhook
 *  - `credentials` are masked on read; the value is
 *    written in clear and stored as JSON
 *  - `retry_policy` is `{ "tries": 5, "backoff": [60,300,900,3600] }`
 *
 * @property string $id
 * @property string $channel
 * @property string $code
 * @property string $display_name
 * @property array<string, mixed>|null $credentials
 * @property array<string, mixed>|null $retry_policy
 * @property array<string, mixed>|null $settings
 * @property array<string, mixed>|null $per_locale_defaults
 * @property bool $active
 */
class NotificationChannelConfig extends Model
{
    /**
     * @use HasFactory<NotificationChannelConfigFactory>
     */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'notification_channel_configs';

    public const CHANNELS = ['mail', 'push', 'sms', 'webhook'];

    public const DEFAULT_RETRY = [
        'tries' => 5,
        'backoff' => [60, 300, 900, 3600],
    ];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'channel',
        'code',
        'display_name',
        'credentials',
        'retry_policy',
        'settings',
        'per_locale_defaults',
        'active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'credentials' => 'array',
            'retry_policy' => 'array',
            'settings' => 'array',
            'per_locale_defaults' => 'array',
            'active' => 'boolean',
        ];
    }
}
