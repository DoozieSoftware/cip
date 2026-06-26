<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use Database\Factories\Modules\Reports\Models\ReportPriorityFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * `report_priorities` row per docs/04 §7.
 *
 * @property string $id
 * @property string $code
 * @property string $name
 * @property int $sla_minutes
 * @property string|null $color
 * @property int $sort_order
 * @property bool $active
 */
class ReportPriority extends Model
{
    /**
     * @use HasFactory<ReportPriorityFactory>
     */
    use HasFactory;

    use HasUuids;

    protected $table = 'report_priorities';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'code',
        'name',
        'sla_minutes',
        'color',
        'sort_order',
        'active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sla_minutes' => 'integer',
            'sort_order' => 'integer',
            'active' => 'boolean',
        ];
    }
}
