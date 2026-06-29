<?php

declare(strict_types=1);

namespace App\Modules\Reports\Services;

use App\Modules\Reports\Events\ReportTypeCreated;
use App\Modules\Reports\Events\ReportTypeDeleted;
use App\Modules\Reports\Events\ReportTypeUpdated;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Shared\Services\BaseService;

/**
 * T-M12-003 — write-side service for Super Admin
 * `report_types` CRUD.
 *
 * Centralises: cast normalisation, transaction wrapping,
 * and lifecycle event dispatch.
 */
class AdminReportTypeService extends BaseService
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): ReportType
    {
        return $this->transaction(function () use ($data): ReportType {
            $type = ReportType::query()->create($this->normalise($data));
            $this->emit(new ReportTypeCreated($type));

            return $type;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(ReportType $type, array $data): ReportType
    {
        return $this->transaction(function () use ($type, $data): ReportType {
            $type->fill($this->normalise($data));
            $type->save();
            $this->emit(new ReportTypeUpdated($type));

            return $type;
        });
    }

    public function delete(ReportType $type): void
    {
        $this->transaction(function () use ($type): void {
            $type->delete();
            $this->emit(new ReportTypeDeleted($type));
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalise(array $data): array
    {
        $defaults = [
            'requires_video' => false,
            'requires_photo' => true,
            'min_photos' => 1,
            'max_photos' => 5,
            'active' => true,
        ];
        foreach ($defaults as $key => $value) {
            if (! array_key_exists($key, $data)) {
                $data[$key] = $value;
            }
        }

        return $data;
    }
}
