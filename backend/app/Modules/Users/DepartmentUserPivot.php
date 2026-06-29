<?php

declare(strict_types=1);

namespace App\Modules\Users;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * Pivot model for `department_users`.
 *
 * The pivot has its own UUID `id` primary key (per the existing
 * migration) plus `is_manager` and `assigned_at` columns. By
 * extending Eloquent's Pivot class we get automatic id
 * generation on `attach()` and clean relation metadata for
 * Eloquent's belongsToMany.
 */
class DepartmentUserPivot extends Pivot
{
    protected $table = 'department_users';

    public $incrementing = false;

    protected $keyType = 'string';

    use HasUuids;

    public $timestamps = true;

    protected $fillable = [
        'user_id',
        'department_id',
        'is_manager',
        'assigned_at',
    ];
}
