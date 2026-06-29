<?php

declare(strict_types=1);

namespace App\Modules\Security\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * T-M12-010 — Security policy row per `docs/09` §19.
 *
 * Database-driven knobs that the Super Admin screen
 * configures at runtime: password policy, OTP expiry,
 * JWT lifetime, session timeout, allowed/blocked
 * domains and IPs, rate limits, and the media
 * upload limits.
 *
 *  - `key`  is the stable identifier consumed by code
 *  - `value` is the typed payload (e.g. {"min": 8, "require_symbol": true})
 *  - `type`  hints the renderer
 *
 * @property string $id
 * @property string $key
 * @property array<string, mixed>|null $value
 * @property string $type
 * @property string|null $description
 */
class SecurityPolicy extends Model
{
    use HasUuids;

    protected $table = 'security_policies';

    public const TYPES = ['string', 'int', 'bool', 'array'];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'key',
        'value',
        'type',
        'description',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'value' => 'array',
        ];
    }
}
