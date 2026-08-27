<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\DTO;

use App\Modules\TextileCollections\Models\TextileCollectionRequest;

final readonly class TextileCollectionInput
{
    public function __construct(
        public string $serviceZoneId,
        public string $category,
        public string $requesterType,
        public string $requesterName,
        public ?string $rwaName,
        public string $contactEmail,
        public string $contactPhone,
        public string $pickupAddress,
        public string $collectionMethod,
        public ?int $estimatedBags,
        public ?float $estimatedWeightKg,
    ) {}

    /** @param array<mixed, mixed> $values */
    public static function fromValidated(array $values): self
    {
        $category = self::string($values, 'category');

        if ($category === '' || ! in_array($category, TextileCollectionRequest::VALID_CATEGORIES, true)) {
            $category = 'clothes_waste';
        }

        return new self(
            serviceZoneId: self::string($values, 'service_zone_id'),
            category: $category,
            requesterType: self::string($values, 'requester_type'),
            requesterName: self::string($values, 'requester_name'),
            rwaName: self::nullableString($values, 'rwa_name'),
            contactEmail: self::string($values, 'contact_email'),
            contactPhone: self::string($values, 'contact_phone'),
            pickupAddress: self::string($values, 'pickup_address'),
            collectionMethod: self::string($values, 'collection_method'),
            estimatedBags: is_numeric($values['estimated_bags'] ?? null) ? (int) $values['estimated_bags'] : null,
            estimatedWeightKg: is_numeric($values['estimated_weight_kg'] ?? null) ? (float) $values['estimated_weight_kg'] : null,
        );
    }

    /** @param array<mixed, mixed> $values */
    private static function string(array $values, string $key): string
    {
        $value = $values[$key] ?? null;

        return is_string($value) ? trim($value) : '';
    }

    /** @param array<mixed, mixed> $values */
    private static function nullableString(array $values, string $key): ?string
    {
        $value = self::string($values, $key);

        return $value === '' ? null : $value;
    }
}
