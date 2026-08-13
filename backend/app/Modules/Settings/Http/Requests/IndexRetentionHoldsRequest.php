<?php

declare(strict_types=1);

namespace App\Modules\Settings\Http\Requests;

use App\Modules\Settings\Services\RetentionHoldService;
use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

final class IndexRetentionHoldsRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user('sanctum');

        return $user instanceof User && $user->hasRole('super_admin');
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'entity_type' => ['nullable', 'string', 'in:'.implode(',', RetentionHoldService::supportedEntityTypes())],
            'entity_id' => ['nullable', 'uuid'],
            'active' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
