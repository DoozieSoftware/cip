<?php

declare(strict_types=1);

namespace App\Modules\Media\Models;

use App\Modules\Users\Models\User;
use Database\Factories\Modules\Media\Models\MediaAccessLogFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * `media_access_logs` row per docs/04 §15 and docs/11 §15.
 *
 * Append-only. The model intentionally does not expose
 * update / delete: the chain of custody is the row itself.
 *
 * Event taxonomy:
 *   - VIEW         : the citizen / staff list endpoint
 *                    (GET /api/v1/reports/{id}/media) was
 *                    called and the row was returned
 *   - DOWNLOAD     : the bytes were streamed (signed serve)
 *   - REPLACE      : a newer version superseded this one
 *   - DELETE       : a hard-delete (M16 hardening) removed
 *                    the row
 *   - VIRUS_SCAN   : the virus scanner produced a verdict
 *                    (LogScanner / ClamAvScanner)
 *
 * @property string $id
 * @property string $media_id
 * @property string|null $actor_id
 * @property string $event
 * @property string|null $ip
 * @property string|null $user_agent
 * @property array<string, mixed>|null $metadata
 * @property Carbon $created_at
 */
class MediaAccessLog extends Model
{
    /**
     * @use HasFactory<MediaAccessLogFactory>
     */
    use HasFactory;

    use HasUuids;

    protected $table = 'media_access_logs';

    /** @var list<string> */
    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'media_id',
        'actor_id',
        'event',
        'ip',
        'user_agent',
        'metadata',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'metadata' => 'array',
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

    /**
     * @return BelongsTo<User, $this>
     */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
