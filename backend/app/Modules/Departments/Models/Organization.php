<?php

declare(strict_types=1);

namespace App\Modules\Departments\Models;

use Database\Factories\Modules\Departments\Models\OrganizationFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * T-M12-013 — `organizations` row per `docs/09` §6.
 *
 * Multi-tenant scaffold. One row per organisation.
 *
 *  - `code` is the unique slug (e.g. "gmc", "bbmp")
 *  - `branding` holds the per-tenant visual identity
 *    (logo URL, primary / secondary colours, footer)
 *  - `storage_quota_mb` is the per-tenant media ceiling
 *  - `settings` is a free-form JSON bag for the
 *    organisation-level configuration that the Super
 *    Admin screen exposes
 *
 * @property string $id
 * @property string $code
 * @property string $name
 * @property string|null $legal_name
 * @property string|null $domain
 * @property array<string, mixed>|null $contact
 * @property array<string, mixed>|null $branding
 * @property int $storage_quota_mb
 * @property array<string, mixed>|null $settings
 * @property bool $active
 */
class Organization extends Model
{
    /**
     * @use HasFactory<OrganizationFactory>
     */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'organizations';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'code',
        'name',
        'legal_name',
        'domain',
        'contact',
        'branding',
        'storage_quota_mb',
        'settings',
        'active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'contact' => 'array',
            'branding' => 'array',
            'settings' => 'array',
            'storage_quota_mb' => 'integer',
            'active' => 'boolean',
        ];
    }
}
