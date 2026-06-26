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
            citizenId: (string) ($validated['citizen_id'] ?? ''),
            reportTypeId: (string) ($validated['report_type_id'] ?? ''),
            locationId: (string) ($validated['location_id'] ?? ''),
            priorityId: (string) ($validated['priority_id'] ?? ''),
            currentStatusId: (string) ($validated['current_status_id'] ?? ''),
            title: (string) ($validated['title'] ?? ''),
            description: (string) ($validated['description'] ?? ''),
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
