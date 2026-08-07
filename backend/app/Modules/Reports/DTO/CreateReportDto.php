<?php

declare(strict_types=1);

namespace App\Modules\Reports\DTO;

/**
 * Immutable payload describing a new report draft.
 *
 * The Form Request validates the wire payload; this DTO is the
 * validated, immutable object the service consumes. No HTTP
 * types here.
 */
final readonly class CreateReportDto
{
    /**
     * @param  array<string, mixed>  $extra
     */
    public function __construct(
        public string $citizenId,
        public string $reportTypeId,
        public string $locationId,
        public string $priorityId,
        public string $currentStatusId,
        public string $title,
        public string $description,
        public bool $isAnonymous = false,
        public ?string $departmentId = null,
        public array $extra = [],
    ) {}

    /**
     * @param  array<string, mixed>  $validated
     */
    public static function fromArray(array $validated): self
    {
        return new self(
            citizenId: is_scalar($validated['citizen_id'] ?? null) ? (string) $validated['citizen_id'] : '',
            reportTypeId: is_scalar($validated['report_type_id'] ?? null) ? (string) $validated['report_type_id'] : '',
            locationId: is_scalar($validated['location_id'] ?? null) ? (string) $validated['location_id'] : '',
            priorityId: is_scalar($validated['priority_id'] ?? null) ? (string) $validated['priority_id'] : '',
            currentStatusId: is_scalar($validated['current_status_id'] ?? null) ? (string) $validated['current_status_id'] : '',
            title: is_scalar($validated['title'] ?? null) ? (string) $validated['title'] : '',
            description: is_scalar($validated['description'] ?? null) ? (string) $validated['description'] : '',
            isAnonymous: (bool) ($validated['is_anonymous'] ?? false),
            departmentId: isset($validated['department_id']) && is_string($validated['department_id'])
                ? $validated['department_id']
                : null,
            extra: array_diff_key($validated, array_flip([
                'citizen_id', 'report_type_id', 'location_id', 'priority_id',
                'current_status_id', 'title', 'description', 'is_anonymous',
                'department_id',
            ])),
        );
    }
}
