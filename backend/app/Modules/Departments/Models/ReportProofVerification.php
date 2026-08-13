<?php

declare(strict_types=1);

namespace App\Modules\Departments\Models;

use App\Modules\Media\Models\Media;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportAssignment;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * AI-assisted comparison between the original citizen evidence and
 * department proof-of-completion media.
 *
 * The row deliberately separates location and visual confidence so the UI can
 * explain perspective differences without hiding missing/weak GPS evidence.
 *
 * @property string $id
 * @property string $report_id
 * @property string|null $assignment_id
 * @property string|null $department_id
 * @property string|null $evidence_media_id
 * @property string $proof_media_id
 * @property string $status
 * @property int $location_confidence
 * @property int $visual_confidence
 * @property int $overall_confidence
 * @property float|null $distance_meters
 * @property bool|null $location_match
 * @property string $summary
 * @property string|null $perspective_note
 * @property array<string, mixed>|null $metadata
 * @property Carbon $checked_at
 */
class ReportProofVerification extends Model
{
    use HasUuids;

    protected $table = 'report_proof_verifications';

    /** @var list<string> */
    protected $fillable = [
        'report_id',
        'assignment_id',
        'department_id',
        'evidence_media_id',
        'proof_media_id',
        'status',
        'location_confidence',
        'visual_confidence',
        'overall_confidence',
        'distance_meters',
        'location_match',
        'summary',
        'perspective_note',
        'metadata',
        'checked_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'location_confidence' => 'integer',
            'visual_confidence' => 'integer',
            'overall_confidence' => 'integer',
            'distance_meters' => 'float',
            'location_match' => 'boolean',
            'metadata' => 'array',
            'checked_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Report, $this> */
    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }

    /** @return BelongsTo<ReportAssignment, $this> */
    public function assignment(): BelongsTo
    {
        return $this->belongsTo(ReportAssignment::class, 'assignment_id');
    }

    /** @return BelongsTo<Media, $this> */
    public function evidenceMedia(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'evidence_media_id');
    }

    /** @return BelongsTo<Media, $this> */
    public function proofMedia(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'proof_media_id');
    }
}
