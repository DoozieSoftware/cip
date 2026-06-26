<?php

declare(strict_types=1);

namespace App\Modules\Departments\DTOs;

/**
 * Generic DTO used by the GeographyService for any
 * country / state / district / city / zone / ward write.
 * Validation is the Form Request's job; the DTO is the
 * validated, immutable payload the service consumes.
 *
 * The shape is intentionally permissive — every level of
 * the geography tree can carry a different subset of
 * fields. The service applies the right subset per
 * level.
 */
final readonly class GeographyDTO
{
    /**
     * @param  array<string, mixed>  $attributes
     */
    public function __construct(
        public string $level,
        public string $name,
        public ?string $code = null,
        public ?string $parentId = null,
        public bool $active = true,
        public array $attributes = [],
    ) {}

    /**
     * @param  array<string, mixed>  $validated
     */
    public static function fromArray(string $level, array $validated): self
    {
        return new self(
            level: $level,
            name: is_string($validated['name'] ?? null) ? $validated['name'] : '',
            code: isset($validated['code']) && is_string($validated['code']) ? $validated['code'] : null,
            parentId: isset($validated['parent_id']) && is_string($validated['parent_id']) ? $validated['parent_id'] : null,
            active: (bool) ($validated['active'] ?? true),
            attributes: array_diff_key($validated, array_flip(['name', 'code', 'parent_id', 'active'])),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toRow(): array
    {
        return array_merge(
            ['name' => $this->name, 'active' => $this->active],
            $this->code !== null ? ['code' => $this->code] : [],
            $this->parentId !== null ? ['parent_id' => $this->parentId] : [],
            $this->attributes,
        );
    }
}
