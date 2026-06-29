<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * M11 — Department dashboard summary per `docs/08` §4.
 */
class DashboardResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $d = $this->resource;
        return [
            'department_id' => $d['department_id'] ?? null,
            'open' => $d['open'] ?? 0,
            'due_today' => $d['due_today'] ?? 0,
            'sla_breached' => $d['sla_breached'] ?? 0,
            'by_category' => $d['by_category'] ?? [],
        ];
    }
}
