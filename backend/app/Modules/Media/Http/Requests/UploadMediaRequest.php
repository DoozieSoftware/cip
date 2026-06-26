<?php

declare(strict_types=1);

namespace App\Modules\Media\Http\Requests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * UploadMediaRequest — gates the multipart payload for
 * POST /api/v1/reports/{id}/photos and
 * POST /api/v1/reports/{id}/video.
 *
 * The field name is parameterised so the same class is used
 * for both photos[] and video. Mime, size, and per-report
 * count caps are enforced in the service layer
 * (MediaService::uploadPhoto / uploadVideo) because they
 * depend on storage state and VirusScanService verdict.
 */
class UploadMediaRequest extends FormRequest
{
    /**
     * The field name on the multipart envelope. Set by the
     * route's controller method via $request->setField(...)
     * or directly via attribute injection in tests.
     */
    public string $fieldName = 'photos';

    public function authorize(): bool
    {
        $user = $this->user('sanctum');

        return $user instanceof User;
    }

    public function withField(string $name): self
    {
        $clone = clone $this;
        $clone->fieldName = $name;

        return $clone;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            $this->fieldName => ['required', 'array', 'min:1', 'max:10'],
            $this->fieldName.'.*' => ['file', 'max:25600'], // 25 MB cap at the request layer
        ];
    }
}
