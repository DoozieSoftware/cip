<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Models;

use App\Modules\Departments\Models\Department;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Declares which waste categories a partner department collects.
 *
 * A department with ≥1 row in this table is a "collection partner".
 * Cross-partner pickup is enabled by adding capability rows — no
 * code changes needed.
 */
final class TextilePartnerCapability extends Model
{
    use HasUuids;

    protected $table = 'textile_partner_capabilities';

    /** @var list<string> */
    protected $fillable = [
        'department_id',
        'category',
    ];

    /** @return BelongsTo<Department, $this> */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }
}
