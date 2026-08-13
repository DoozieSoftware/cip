<?php

declare(strict_types=1);

namespace App\Modules\Media\Models;

use App\Modules\Media\Enums\MediaQuarantineReason;
use App\Modules\Media\Enums\MediaQuarantineStatus;
use Database\Factories\Modules\Media\Models\MediaQuarantineFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Operational custody record for an upload whose bytes are isolated from the
 * deliverable evidence namespace until a scanner produces a CLEAN verdict.
 *
 * @property string $id
 * @property string $media_id
 * @property MediaQuarantineStatus $status
 * @property MediaQuarantineReason $reason
 * @property string $scanner
 * @property string $original_sha256
 * @property int $scan_attempts
 * @property string|null $last_error
 * @property Carbon $quarantined_at
 * @property Carbon|null $last_attempted_at
 * @property Carbon|null $released_at
 * @property-read Media $media
 */
final class MediaQuarantine extends Model
{
    /** @use HasFactory<MediaQuarantineFactory> */
    use HasFactory;

    use HasUuids;

    protected $table = 'media_quarantines';

    /** @var list<string> */
    protected $fillable = [
        'media_id',
        'status',
        'reason',
        'scanner',
        'original_sha256',
        'scan_attempts',
        'last_error',
        'quarantined_at',
        'last_attempted_at',
        'released_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => MediaQuarantineStatus::class,
            'reason' => MediaQuarantineReason::class,
            'scan_attempts' => 'integer',
            'quarantined_at' => 'datetime',
            'last_attempted_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Media, $this> */
    public function media(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'media_id');
    }
}
