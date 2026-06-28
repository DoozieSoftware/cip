<?php

declare(strict_types=1);

namespace App\Modules\Moderation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Form request for the bulk duplicate-fold endpoint:
 *   POST /api/v1/moderator/reports/{report}/merge
 *
 * The `duplicate_report_ids` array carries the source
 * reports that are about to be folded into the canonical
 * (the route's `{report}` segment). The moderator must
 * provide a reason code (or remarks) so the audit row
 * is self-explanatory.
 */
class StoreBulkMergeRequest extends FormRequest
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
            'duplicate_report_ids' => ['required', 'array', 'min:1'],
            'duplicate_report_ids.*' => ['string', 'uuid', 'different:report'],
            'reason_code' => ['nullable', 'string', 'max:64'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
