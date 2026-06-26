<?php

declare(strict_types=1);

namespace App\Modules\Departments\Models;

use Database\Factories\Modules\Departments\Models\DistrictFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * District master. Part of the Location Domain per docs/04 §8.
 *
 * @property string $id
 * @property string $state_id
 * @property string $name
 * @property string $code
 * @property bool $active
 */
class District extends Model
{
    /**
     * @use HasFactory<DistrictFactory>
     */
    use HasFactory;

    use HasUuids;

    protected $table = 'districts';

    /**
     * @var list<string>
     */
    protected $fillable = ['state_id', 'name', 'code', 'active'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    /**
     * @return BelongsTo<State, $this>
     */
    public function state(): BelongsTo
    {
        return $this->belongsTo(State::class, 'state_id');
    }
}
