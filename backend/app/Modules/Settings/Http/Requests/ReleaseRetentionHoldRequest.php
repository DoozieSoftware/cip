<?php

declare(strict_types=1);

namespace App\Modules\Settings\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

final class ReleaseRetentionHoldRequest extends FormRequest
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
            'release_reason' => ['required', 'string', 'min:10', 'max:2000'],
        ];
    }
}
