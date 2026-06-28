<?php

declare(strict_types=1);

namespace App\Modules\Moderation\Http\Requests;

use App\Modules\Moderation\DTO\ReviewReportDto;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Form request for the per-report moderator action:
 *   POST /api/v1/moderator/reports/{report}/review
 *
 * The decision field discriminates the four moderator
 * actions (approve / reject / merge / escalate). The
 * ReviewReportDto enforces the cross-field invariants
 * (e.g. merge requires merge_into_report_id).
 */
class StoreReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, array<int, mixed>|string>
     */
    public function rules(): array
    {
        return [
            // `decision` is optional in the wire payload because the
            // `reject` and `escalate` shortcut endpoints set it
            // themselves. The per-decision value is enforced by the
            // ReviewReportDto::fromArray() factory.
            'decision' => ['nullable', 'string', 'in:approve,reject,merge,escalate'],
            'department_id' => ['nullable', 'string', 'uuid'],
            'category_id' => ['nullable', 'string', 'uuid'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['string', 'uuid'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'override_ai' => ['nullable', 'boolean'],
            'merge_into_report_id' => ['nullable', 'string', 'uuid', 'different:report'],
            'reason_code' => ['nullable', 'string', 'max:64'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'decision.in' => 'decision must be one of: approve, reject, merge, escalate.',
            'merge_into_report_id.different' => 'A report cannot be merged into itself.',
        ];
    }

    public function toDto(): ReviewReportDto
    {
        /** @var array<string, mixed> $payload */
        $payload = $this->validated();
        $payload['merge_into_report_id'] = $payload['merge_into_report_id'] ?? $this->route('report');

        return ReviewReportDto::fromArray($payload);
    }
}
