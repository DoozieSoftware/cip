<?php

declare(strict_types=1);

namespace App\Modules\Authentication\Models;

use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string|null $user_id
 * @property string $request_secret_hash
 * @property string $approval_secret_hash
 * @property string $status
 * @property Carbon $expires_at
 * @property Carbon|null $consumed_at
 * @property User|null $user
 */
class PushLoginChallenge extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id',
        'request_secret_hash',
        'approval_secret_hash',
        'status',
        'request_ip',
        'request_user_agent',
        'approved_by',
        'expires_at',
        'decided_at',
        'consumed_at',
    ];

    protected $hidden = ['request_secret_hash', 'approval_secret_hash'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'decided_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
