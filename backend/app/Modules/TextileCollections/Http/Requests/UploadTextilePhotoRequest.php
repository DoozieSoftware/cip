<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the multipart payload for textile collection photo uploads.
 *
 * Used by both the citizen evidence endpoint and the staff proof endpoint.
 * Mime and size caps are enforced in TextileCollectionMediaService to
 * stay consistent with the report-media pattern.
 */
final class UploadTextilePhotoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'photo' => [
                'required',
                'file',
                'mimes:jpeg,png,webp',
                'max:10240', // 10 MB in KB
            ],
        ];
    }
}
