<?php

declare(strict_types=1);

namespace App\Modules\Departments\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Emitted by DepartmentService::update() after a department row
 * is persisted. Carries the department id and a before/after
 * snapshot of the changed columns.
 */
class DepartmentUpdated
{
    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    use Dispatchable;

    use SerializesModels;

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    public function __construct(
        public readonly string $departmentId,
        public readonly array $before,
        public readonly array $after,
    ) {}
}
