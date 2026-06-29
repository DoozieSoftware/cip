<?php

declare(strict_types=1);

namespace App\Modules\Departments\Services;

use App\Modules\Departments\Models\Organization;
use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Support\Facades\DB;

/**
 * T-M12-013 — Super Admin write-side for organizations.
 */
class OrganizationAdminService
{
    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): Organization
    {
        $code = (string) ($attributes['code'] ?? '');
        $this->assertUniqueCode($code, null);

        return DB::transaction(function () use ($attributes, $code): Organization {
            return Organization::query()->create([
                'code' => $code,
                'name' => (string) $attributes['name'],
                'legal_name' => $attributes['legal_name'] ?? null,
                'domain' => $attributes['domain'] ?? null,
                'contact' => $attributes['contact'] ?? null,
                'branding' => $attributes['branding'] ?? null,
                'storage_quota_mb' => (int) ($attributes['storage_quota_mb'] ?? 5120),
                'settings' => $attributes['settings'] ?? null,
                'active' => array_key_exists('active', $attributes) ? (bool) $attributes['active'] : true,
            ]);
        });
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(Organization $organization, array $attributes): Organization
    {
        if (array_key_exists('code', $attributes)) {
            $this->assertUniqueCode((string) $attributes['code'], $organization->id);
        }

        return DB::transaction(function () use ($organization, $attributes): Organization {
            $organization->fill(array_intersect_key($attributes, array_flip([
                'code', 'name', 'legal_name', 'domain', 'contact',
                'branding', 'storage_quota_mb', 'settings', 'active',
            ])));
            $organization->save();

            return $organization->refresh();
        });
    }

    public function delete(Organization $organization): void
    {
        DB::transaction(function () use ($organization): void {
            $organization->delete();
        });
    }

    public function restore(Organization $organization): Organization
    {
        DB::transaction(function () use ($organization): void {
            $organization->restore();
        });

        return $organization->refresh();
    }

    private function assertUniqueCode(string $code, ?string $ignoreId): void
    {
        if ($code === '') {
            throw new ApiException('VALIDATION_FAILED', 'Organization code is required.', 422);
        }

        $existing = Organization::query()->where('code', $code);

        if ($ignoreId !== null) {
            $existing->where('id', '!=', $ignoreId);
        }

        if ($existing->withTrashed()->exists()) {
            throw new ApiException('DUPLICATE_CODE', "Organization code '{$code}' is already in use.", 409);
        }
    }
}
