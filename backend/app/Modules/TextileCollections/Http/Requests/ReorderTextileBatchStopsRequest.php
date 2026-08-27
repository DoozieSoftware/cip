<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

final class ReorderTextileBatchStopsRequest extends FormRequest
{
    public function authorize(): bool { return $this->user() instanceof User; }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'ordered_ids' => ['required','array','min:1'],
            'ordered_ids.*' => ['required','uuid','exists:textile_collection_requests,id'],
        ];
    }
}
