<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

final class AssignTextileBatchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'assigned_team_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'assigned_user_id' => ['nullable', 'uuid', 'exists:users,id'],
            'vehicle_label' => ['nullable', 'string', 'max:64'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
