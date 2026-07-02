<?php

declare(strict_types=1);

namespace App\Modules\Users\Http\Requests\Admin;

use App\Modules\Security\Services\SecurityPolicyService;
use App\Modules\Users\Services\AdminUserService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * T-M12-001 — `PUT /api/v1/admin/users/{user}` form request.
 */
class UpdateUserRequest extends FormRequest
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
        $userId = $this->route('user');
        $userId = is_object($userId) && method_exists($userId, 'getKey')
            ? $userId->getKey()
            : (is_string($userId) ? $userId : (string) $userId);

        return [
            'name' => ['nullable', 'string', 'max:255'],
            'mobile' => [
                'nullable',
                'string',
                'max:32',
                Rule::unique('users', 'mobile')->ignore($userId),
            ],
            'email' => [
                'nullable',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($userId),
            ],
            'password' => ['nullable', 'string', 'max:128', app(SecurityPolicyService::class)->passwordRule()],
            'status' => ['nullable', 'string', 'in:'.implode(',', AdminUserService::ALLOWED_STATUSES)],
            'anonymous_enabled' => ['nullable', 'boolean'],
            'roles' => ['nullable', 'array'],
            'roles.*' => ['string', 'max:64'],
        ];
    }
}
