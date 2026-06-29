<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InternalNoteResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $n = $this->resource;
        return [
            'id' => $n->id,
            'report_id' => $n->report_id,
            'department_id' => $n->department_id,
            'author_id' => $n->author_id,
            'author_name' => $n->relationLoaded('author') ? $n->author?->name : null,
            'body' => $n->body,
            'created_at' => $n->created_at?->toIso8601String(),
        ];
    }
}
