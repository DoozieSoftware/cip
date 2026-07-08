<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * `push_subscriptions` row per docs/04 §13.
 *
 * @property string $id
 * @property string $user_id
 * @property string $endpoint
 * @property array<string, string> $keys
 * @property string|null $content_encoding
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class PushSubscription extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'push_subscriptions';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'endpoint',
        'keys',
        'content_encoding',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'keys' => 'array',
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
