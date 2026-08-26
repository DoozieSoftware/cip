<?php

declare(strict_types=1);

namespace App\Modules\Media\Models;

use App\Modules\Departments\Models\Department;
use App\Modules\Media\Enums\MediaScanStatus;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\Users\Models\User;
use Database\Factories\Modules\Media\Models\MediaFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * `media` row per docs/04 §9.
 *
 * One row per evidence asset attached to a Report. The asset
 * lives on a Laravel filesystem disk (configured by
 * `storage_disk` — `minio` in production, `local` in tests) and
 * is identified inside the disk by the unique `storage_path`.
 *
 *   - type        : PHOTO | VIDEO | DOCUMENT
 *   - mime, size  : asset metadata captured at upload time
 *   - checksum    : sha256 hex digest (64 chars) — full chain is
 *                   on the MediaHash row (T-M5-002 / T-M5-005)
 *   - version     : 1, increments when the chain-of-custody
 *                   layer (T-M5-016) replaces the asset
 *   - is_replaced : true once a newer version of the same
 *                   logical asset exists
 *
 * @property string $id
 * @property string $report_id
 * @property string|null $assignment_id
 * @property string|null $department_id
 * @property string $type
 * @property string $role
 * @property string $storage_disk
 * @property string $storage_path
 * @property string $mime
 * @property int $size
 * @property int|null $duration
 * @property int|null $width
 * @property int|null $height
 * @property string $checksum
 * @property MediaScanStatus $scan_status
 * @property Carbon|null $scan_attempted_at
 * @property Carbon|null $captured_at
 * @property Carbon $uploaded_at
 * @property string|null $uploaded_by
 * @property array<string, mixed>|null $metadata
 * @property int $version
 * @property bool $is_replaced
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Media extends Model
{
    /**
     * @use HasFactory<MediaFactory>
     */
    use HasFactory;

    use HasUuids;

    protected $table = 'media';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'report_id',
        'textile_collection_id',
        'assignment_id',
        'department_id',
        'type',
        'role',
        'storage_disk',
        'storage_path',
        'mime',
        'size',
        'duration',
        'width',
        'height',
        'checksum',
        'scan_status',
        'scan_attempted_at',
        'captured_at',
        'uploaded_at',
        'uploaded_by',
        'metadata',
        'version',
        'is_replaced',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'duration' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'version' => 'integer',
            'is_replaced' => 'boolean',
            'scan_status' => MediaScanStatus::class,
            'scan_attempted_at' => 'datetime',
            'captured_at' => 'datetime',
            'uploaded_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    /**
     * @return BelongsTo<Report, $this>
     */
    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }

    /**
     * @return BelongsTo<TextileCollectionRequest, $this>
     */
    public function textileCollection(): BelongsTo
    {
        return $this->belongsTo(TextileCollectionRequest::class, 'textile_collection_id');
    }

    /** @return BelongsTo<ReportAssignment, $this> */
    public function assignment(): BelongsTo
    {
        return $this->belongsTo(ReportAssignment::class, 'assignment_id');
    }

    /** @return BelongsTo<Department, $this> */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * @return HasMany<MediaHash, $this>
     */
    public function hashes(): HasMany
    {
        return $this->hasMany(MediaHash::class, 'media_id');
    }

    /** @return HasOne<MediaQuarantine, $this> */
    public function quarantine(): HasOne
    {
        return $this->hasOne(MediaQuarantine::class, 'media_id');
    }
}
