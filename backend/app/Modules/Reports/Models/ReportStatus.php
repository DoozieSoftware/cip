<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use Database\Factories\Modules\Reports\Models\ReportStatusFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * `report_statuses` row per docs/04 §7.
 *
 * The 11 lifecycle codes from docs/02 §7. The Workflow engine
 * (M6) reads `is_terminal` and `sort_order` to draw the
 * transition graph; the moderator queue renders rows in
 * `sort_order` ASC.
 *
 * @property string $id
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property string|null $color
 * @property bool $is_terminal
 * @property int $sort_order
 * @property bool $active
 */
class ReportStatus extends Model
{
    /**
     * @use HasFactory<ReportStatusFactory>
     */
    use HasFactory;

    use HasUuids;

    protected $table = 'report_statuses';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'code',
        'name',
        'description',
        'color',
        'is_terminal',
        'sort_order',
        'active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_terminal' => 'boolean',
            'sort_order' => 'integer',
            'active' => 'boolean',
        ];
    }
}
