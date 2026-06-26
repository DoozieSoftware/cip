<?php

declare(strict_types=1);

namespace App\Modules\Departments\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Emitted by DepartmentService::delete() after a department row
 * is soft-deleted. Carries the department id and the last
 * snapshot so audit listeners can record the deletion with
 * full context.
 */
class DepartmentDeleted
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
