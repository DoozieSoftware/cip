<?php

declare(strict_types=1);

namespace App\Modules\AI\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * `ai_labels` row per docs/04 §10 and docs/10 §11.
 *
 * Per-label confidence for multi-label classification
 * results. The application invariant is exactly one row
 * per `result_id` with `is_primary = true` (enforced by
 * the AiLabel::saving model event in a later task — for
 * now the DB only carries the column).
 *
 * @property string $id
 * @property string $result_id
 * @property string $label
 * @property float $confidence
 * @property bool $is_primary
 * @property Carbon $created_at
 */
class AiLabel extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'ai_labels';

    public $timestamps = false;

    protected $fillable = [
        'result_id', 'label', 'confidence', 'is_primary', 'created_at',
    ];

    protected $casts = [
        'confidence' => 'float',
        'is_primary' => 'boolean',
        'created_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<AiResult, self>
     */
    public function result(): BelongsTo
    {
        return $this->belongsTo(AiResult::class, 'result_id');
    }
}
