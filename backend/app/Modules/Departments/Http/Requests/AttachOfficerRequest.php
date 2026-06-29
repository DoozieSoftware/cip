<?php

declare(strict_types=1);

namespace App\Modules\Departments\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * T-M11-009 — Attach an officer to a department.
 *
 * Per docs/08 §8 ("Officers"). A user with the `department`
 * (or `department_admin`) role is attached to a department
 * through the `department_users` pivot; the request also
 * captures the optional `is_manager` flag and the
 * `assigned_at` timestamp.
 */
class AttachOfficerRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user('sanctum');

        return $user instanceof User && $user->hasRole('super_admin');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'user_id' => ['required', 'uuid', 'exists:users,id'],
            'is_manager' => ['nullable', 'boolean'],
            'assigned_at' => ['nullable', 'date'],
        ];
    }
}
