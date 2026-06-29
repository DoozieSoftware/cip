<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use App\Modules\Departments\Models\Department;
use App\Modules\Users\Models\User;
use Database\Factories\Modules\Reports\Models\InternalNoteFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * M11 — Department-internal note attached to a report.
 *
 * Notes are private to the department and are NOT visible to
 * citizens. They are immutable once written (corrections go in
 * as a new note) and ordered newest-first by `created_at` in
 * the resource. There is no update / delete endpoint in M11
 * to keep the audit trail clean.
 *
 * @property string $id
 * @property string $report_id
 * @property string $department_id
 * @property string $author_id
 * @property string $body
 * @property Carbon|null $created_at
 */
class InternalNote extends Model
{
    /**
     * @use HasFactory<InternalNoteFactory>
     */
    use HasFactory;

    use HasUuids;

    protected $table = 'report_internal_notes';

    public $timestamps = false;

    protected $fillable = [
        'report_id',
        'department_id',
        'author_id',
        'body',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
