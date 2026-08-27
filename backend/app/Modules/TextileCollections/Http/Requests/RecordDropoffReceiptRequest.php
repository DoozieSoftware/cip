<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

final class RecordDropoffReceiptRequest extends FormRequest
{
    public function authorize(): bool { return $this->user() instanceof User; }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'actual_bags' => ['nullable','integer','min:1','max:999'],
            'actual_weight_kg' => ['nullable','numeric','min:0.1','max:99999.99'],
            'proof_media_id' => ['nullable','uuid','exists:media,id'],
            'exception_code' => ['nullable','string','max:32'],
            'exception_reason' => ['nullable','string','min:5','max:2000'],
        ];
    }
}
