<?php

declare(strict_types=1);

namespace App\Modules\Departments\Models;

use Carbon\CarbonInterface;
use Database\Factories\Modules\Departments\Models\CountryFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Country master. Part of the Location Domain per docs/04 §8.
 *
 *  - UUID primary key (HasUuids)
 *  - unique `iso2` is enforced at the DB level
 *  - `active` is a soft-disable flag (no row delete)
 *
 * @property string $id
 * @property string $name
 * @property string $iso2
 * @property string|null $iso3
 * @property string|null $phone_code
 * @property bool $active
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 */
class Country extends Model
{
    /**
     * @use HasFactory<CountryFactory>
     */
    use HasFactory;

    use HasUuids;

    protected $table = 'countries';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'iso2',
        'iso3',
        'phone_code',
        'active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'active' => 'boolean',
        ];
    }
}
