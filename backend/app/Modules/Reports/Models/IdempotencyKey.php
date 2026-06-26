<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use App\Modules\Users\Models\User;
use Database\Factories\Modules\Reports\Models\IdempotencyKeyFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * `idempotency_keys` row per docs/05 §20.
 *
 * Unique on (key, user_id) so two different citizens can use the
 * same key value without colliding. The route + request_hash let
 * the middleware detect a key reuse with a different payload.
 *
 * @property string $id
 * @property string $key
 * @property string|null $user_id
 * @property string $route
 * @property string $request_hash
 * @property int $response_status
 * @property array<string, mixed>|null $response_body
 * @property Carbon $created_at
 */
class IdempotencyKey extends Model
{
    /**
     * @use HasFactory<IdempotencyKeyFactory>
     */
    use HasFactory;

    use HasUuids;

    public $timestamps = false;

    protected $table = 'idempotency_keys';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'key',
        'user_id',
        'route',
        'request_hash',
        'response_status',
        'response_body',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'response_status' => 'integer',
            'response_body' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
