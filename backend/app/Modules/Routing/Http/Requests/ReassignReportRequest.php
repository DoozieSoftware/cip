<?php

declare(strict_types=1);

namespace App\Modules\Routing\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Form Request for POST /api/v1/admin/reports/{id}/reassign.
 *
 * Per docs/04 sec 12 - Super Admin / moderator manually
 * reassigns a report. `priority_id` is optional; when
 * omitted the report keeps its current priority.
 */
class ReassignReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user('sanctum');

        if (! $user instanceof User) {
            return false;
        }

        return $user->hasRole('super_admin') || $user->hasRole('moderator');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'department_id' => ['required', 'string', 'exists:departments,id'],
            'officer_id' => ['nullable', 'string', 'exists:users,id'],
            'priority_id' => ['nullable', 'string', 'exists:report_priorities,id'],
            'reason' => ['required', 'string', 'min:3', 'max:500'],
        ];
    }
}
