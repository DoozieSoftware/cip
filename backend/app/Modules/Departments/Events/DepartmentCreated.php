<?php

declare(strict_types=1);

namespace App\Modules\Departments\Events;

use App\Modules\Departments\Models\Department;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Emitted by DepartmentService::create() after a department row
 * is persisted. Carries the new department id and a
 * before/after snapshot so listeners (audit middleware, the
 * master-config cache invalidator in T-M3-019) can record the
 * change without re-querying the database.
 */
class DepartmentCreated
{
    use Dispatchable;
    use SerializesModels;

    /**
     * @param  array<string, mixed>  $snapshot
     */
    public function __construct(
        public readonly string $departmentId,
        public readonly array $snapshot,
    ) {}
}
