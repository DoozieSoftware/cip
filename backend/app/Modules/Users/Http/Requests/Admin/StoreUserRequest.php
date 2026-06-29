<?php

declare(strict_types=1);

namespace App\Modules\Users\Http\Requests\Admin;

use App\Modules\Users\Services\AdminUserService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * T-M12-001 — `POST /api/v1/admin/users` form request.
 */
class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null
            && $this->user()->hasAnyRole(['super_admin', 'system']);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['nullable', 'string', 'max:255'],
            'mobile' => ['required', 'string', 'max:32', 'unique:users,mobile'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
            'password' => ['nullable', 'string', 'min:8', 'max:128'],
            'status' => ['nullable', 'string', 'in:' . implode(',', AdminUserService::ALLOWED_STATUSES)],
            'anonymous_enabled' => ['nullable', 'boolean'],
            'roles' => ['nullable', 'array'],
            'roles.*' => ['string', 'max:64'],
        ];
    }
}
