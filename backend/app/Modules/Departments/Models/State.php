<?php

declare(strict_types=1);

namespace App\Modules\Departments\Models;

use Database\Factories\Modules\Departments\Models\StateFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * State master. Part of the Location Domain per docs/04 §8.
 *
 *  - UUID primary key (HasUuids)
 *  - belongs to a Country
 *  - unique (country_id, code) enforced at the DB level
 *
 * @property string $id
 * @property string $country_id
 * @property string $name
 * @property string $code
 * @property bool $active
 */
class State extends Model
{
    /**
     * @use HasFactory<StateFactory>
     */
    use HasFactory;

    use HasUuids;

    protected $table = 'states';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'country_id',
        'name',
        'code',
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

    /**
     * @return BelongsTo<Country, $this>
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class, 'country_id');
    }

    /**
     * @return HasMany<District, $this>
     */
    public function districts(): HasMany
    {
        return $this->hasMany(District::class, 'state_id');
    }
}
