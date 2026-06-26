<?php

declare(strict_types=1);

namespace App\Modules\Media\Models;

use Database\Factories\Modules\Media\Models\MediaHashFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * `media_hashes` row per docs/04 §9.
 *
 * One row per media asset carries the integrity / dedup hashes
 * computed by HashService (T-M5-005) and ComputeHashesJob
 * (T-M5-009):
 *
 *   - sha256            : SHA-256 hex (64 chars) — used for
 *                          chain-of-custody and duplicate
 *                          detection at the bit level
 *   - sha512            : SHA-512 hex (128 chars) — defence in
 *                          depth for tamper detection
 *   - perceptual_hash   : 16 hex char pHash, used for near-
 *                          duplicate detection on images
 *   - video_fingerprint : ffmpeg-derived frame-byte fingerprint,
 *                          nullable for non-video assets
 *
 * The model is append-only; updates are not exposed because
 * hashes are recomputed by a new job run rather than mutated
 * in place.
 *
 * @property string $id
 * @property string $media_id
 * @property string $sha256
 * @property string $sha512
 * @property string $perceptual_hash
 * @property string|null $video_fingerprint
 * @property Carbon $created_at
 */
class MediaHash extends Model
{
    /**
     * @use HasFactory<MediaHashFactory>
     */
    use HasFactory;

    use HasUuids;

    protected $table = 'media_hashes';

    /**
     * @var list<string>
     */
    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'media_id',
        'sha256',
        'sha512',
        'perceptual_hash',
        'video_fingerprint',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Media, $this>
     */
    public function media(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'media_id');
    }
}
