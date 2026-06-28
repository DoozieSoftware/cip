<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Per-(user, channel, event_code) opt-in preference.
 *
 *  - presence:  the user has touched the preference
 *               for this (channel, event) pair
 *  - enabled:   whether to dispatch
 *
 * The dispatcher treats ABSENCE as "default" (look up
 * the platform default in `app_configs.notification_default_opt_in`)
 * and PRESENCE as the explicit value.
 *
 * @property string $id
 * @property string $user_id
 * @property string $channel
 * @property string $event_code
 * @property bool $enabled
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class NotificationPreference extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'notification_preferences';

    protected $fillable = [
        'user_id',
        'channel',
        'event_code',
        'enabled',
    ];

    protected $casts = [
        'enabled' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
