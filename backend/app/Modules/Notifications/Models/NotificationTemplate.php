<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * `notification_templates` row per docs/04 §13.
 *
 * Reusable template keyed by (code, locale, version). The
 * dispatcher picks the active row for (code, locale) and
 * renders `body` via the TemplateEngine (T-M9-011).
 *
 * @property string $id
 * @property string $code
 * @property string $name
 * @property string $channel
 * @property string|null $subject
 * @property string $body
 * @property array|null $variables
 * @property string $locale
 * @property int $version
 * @property bool $active
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class NotificationTemplate extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'notification_templates';

    protected $fillable = [
        'code', 'name', 'channel', 'subject', 'body',
        'variables', 'locale', 'version', 'active',
    ];

    protected $casts = [
        'variables' => 'array',
        'version' => 'integer',
        'active' => 'boolean',
    ];
}
