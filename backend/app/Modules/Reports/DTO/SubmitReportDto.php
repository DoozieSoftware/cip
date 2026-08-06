<?php

declare(strict_types=1);

namespace App\Modules\Reports\DTO;

/**
 * Immutable payload describing the GPS coordinates captured at
 * submission time. The LocationService is the only writer of
 * `Location` rows (T-M4-016); this DTO is the input to
 * `LocationService::createFromSubmission`.
 */
final readonly class SubmitReportDto
{
    public function __construct(
        public string $citizenId,
        public string $reportTypeId,
        public float $latitude,
        public float $longitude,
        public ?float $accuracy = null,
        public ?float $altitude = null,
        public ?float $heading = null,
        public ?float $speed = null,
        public ?string $gpsProvider = null,
        public ?\DateTimeInterface $capturedAt = null,
        public ?string $address = null,
        public string $title = '',
        public string $description = '',
        public bool $isAnonymous = false,
        public ?string $priorityId = null,
        public ?float $mockGpsScore = null,
    ) {}

    /**
     * @param  array<string, mixed>  $validated
     */
    public static function fromArray(array $validated): self
    {
        $capturedAt = null;

        if (isset($validated['captured_at']) && is_string($validated['captured_at'])) {
            try {
                $capturedAt = new \DateTimeImmutable($validated['captured_at']);
            } catch (\Exception) {
                $capturedAt = null;
            }
        }

        return new self(
            citizenId: is_scalar($validated['citizen_id'] ?? null) ? (string) $validated['citizen_id'] : '',
            reportTypeId: is_scalar($validated['report_type_id'] ?? null) ? (string) $validated['report_type_id'] : '',
            latitude: is_numeric($validated['latitude'] ?? null) ? (float) $validated['latitude'] : 0.0,
            longitude: is_numeric($validated['longitude'] ?? null) ? (float) $validated['longitude'] : 0.0,
            accuracy: isset($validated['accuracy']) && is_numeric($validated['accuracy']) ? (float) $validated['accuracy'] : null,
            altitude: isset($validated['altitude']) && is_numeric($validated['altitude']) ? (float) $validated['altitude'] : null,
            heading: isset($validated['heading']) && is_numeric($validated['heading']) ? (float) $validated['heading'] : null,
            speed: isset($validated['speed']) && is_numeric($validated['speed']) ? (float) $validated['speed'] : null,
            gpsProvider: isset($validated['gps_provider']) && is_string($validated['gps_provider'])
                ? $validated['gps_provider']
                : null,
            capturedAt: $capturedAt,
            address: isset($validated['address']) && is_string($validated['address'])
                ? trim($validated['address'])
                : null,
            title: is_scalar($validated['title'] ?? null) ? (string) $validated['title'] : '',
            description: is_scalar($validated['description'] ?? null) ? (string) $validated['description'] : '',
            isAnonymous: (bool) ($validated['is_anonymous'] ?? false),
            priorityId: isset($validated['priority_id']) && is_string($validated['priority_id'])
                ? $validated['priority_id']
                : null,
            mockGpsScore: isset($validated['mock_gps_score']) && is_numeric($validated['mock_gps_score']) ? (float) $validated['mock_gps_score'] : null,
        );
    }
}
