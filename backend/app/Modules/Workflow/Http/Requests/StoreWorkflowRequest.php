<?php

declare(strict_types=1);

namespace App\Modules\Workflow\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Form Request for POST /api/v1/admin/workflows.
 *
 * Per docs/09 sec 11 - Super Admin creates a new workflow
 * definition. The optional `states` + `transitions` blocks
 * allow the Super Admin to ship a full graph in one call;
 * omit them to create an empty definition and use PUT to
 * populate later.
 */
class StoreWorkflowRequest extends FormRequest
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
            'code' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9_]+$/'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'active' => ['nullable', 'boolean'],

            'states' => ['nullable', 'array'],
            'states.*.code' => ['required_with:states', 'string', 'max:64'],
            'states.*.name' => ['required_with:states', 'string', 'max:255'],
            'states.*.description' => ['nullable', 'string'],
            'states.*.is_initial' => ['nullable', 'boolean'],
            'states.*.is_terminal' => ['nullable', 'boolean'],
            'states.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'states.*.color' => ['nullable', 'string', 'max:16'],
            'states.*.active' => ['nullable', 'boolean'],

            'transitions' => ['nullable', 'array'],
            'transitions.*.from_state' => ['required_with:transitions', 'string', 'max:64'],
            'transitions.*.to_state' => ['required_with:transitions', 'string', 'max:64'],
            'transitions.*.event' => ['required_with:transitions', 'string', 'max:64'],
            'transitions.*.required_role' => ['nullable', 'string', 'max:64'],
            'transitions.*.required_permission' => ['nullable', 'string', 'max:128'],
            'transitions.*.conditions' => ['nullable', 'array'],
            'transitions.*.sla_minutes' => ['nullable', 'integer', 'min:1', 'max:525600'],
            'transitions.*.notify_before_minutes' => ['nullable', 'integer', 'min:0', 'max:525600'],
            'transitions.*.priority' => ['nullable', 'integer', 'min:0'],
            'transitions.*.active' => ['nullable', 'boolean'],
        ];
    }
}
