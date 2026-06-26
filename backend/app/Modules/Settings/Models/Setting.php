<?php

declare(strict_types=1);

namespace App\Modules\Settings\Models;

use Database\Factories\Modules\Settings\Models\SettingFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Global `settings` row per docs/04 §18 and docs/09 §18.
 *
 *  - `key` is the dotted-path identifier (e.g. "ai.vision.provider").
 *  - `value` is always JSON; the `type` column tells the renderer
 *    how to coerce it on read (string / int / bool / json / datetime).
 *  - `is_public` controls whether the citizen PWA may read the
 *    setting without authentication.
 *  - Soft deletes so `forget()` preserves an audit trail.
 *
 * The model exposes two static helpers — `Setting::get($key, $default)`
 * and `Setting::set($key, $value, $type)` — that hit the database
 * directly. The `SettingsService` (T-M3-012) wraps these with a
 * Redis cache; everything that does not need the cache (the seeder,
 * the test suite, the super admin write path) calls these directly.
 *
 * @property string $id
 * @property string $key
 * @property mixed $value
 * @property string $type
 * @property string|null $description
 * @property bool $is_public
 */
class Setting extends Model
{
    /**
     * @use HasFactory<SettingFactory>
     */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'settings';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'key',
        'value',
        'type',
        'description',
        'is_public',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'value' => 'array',
            'is_public' => 'boolean',
        ];
    }

    /**
     * Read a setting by key. Returns `$default` if the row does
     * not exist (or has been soft-deleted). The returned value is
     * coerced from JSON into the declared `type`; if `type` is
     * missing it is returned as-is.
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        $row = static::query()->where('key', $key)->first();

        if ($row === null) {
            return $default;
        }

        return static::coerce($row->value, $row->type);
    }

    /**
     * Upsert a setting by key. `value` is stored as JSON regardless
     * of `type`; `type` is metadata that the reader uses to coerce
     * it back.
     */
    public static function set(string $key, mixed $value, string $type = 'string'): static
    {
        return static::query()->updateOrCreate(
            ['key' => $key],
            [
                'value' => $value,
                'type' => $type,
            ],
        );
    }

    /**
     * Coerce a JSON-decoded value into the declared type. JSON
     * already produces the right PHP value for int / bool / string;
     * for `datetime` we parse an ISO 8601 string into a Carbon
     * instance. Unknown types pass through unchanged.
     */
    protected static function coerce(mixed $value, string $type): mixed
    {
        return match ($type) {
            'int', 'integer' => is_numeric($value) ? (int) $value : null,
            'bool', 'boolean' => is_bool($value) ? $value : (bool) $value,
            'string' => is_scalar($value) ? (string) $value : $value,
            'datetime' => is_string($value) ? Carbon::parse($value) : $value,
            default => $value,
        };
    }
}
