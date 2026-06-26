<?php

declare(strict_types=1);

namespace App\Modules\Routing\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Form Request for POST /api/v1/admin/routing-rules/reorder.
 *
 * Body shape:
 *   { "order": ["<rule_id>", "<rule_id>", ...] }
 *
 * Rules are assigned priorities in 10-step increments
 * starting at 10, so the reorder endpoint can persist
 * the new order without a per-row update.
 */
class ReorderRoutingRulesRequest extends FormRequest
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
            'order' => ['required', 'array', 'min:1'],
            'order.*' => ['required', 'string'],
        ];
    }
}
