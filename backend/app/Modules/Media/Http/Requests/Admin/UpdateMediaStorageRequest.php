<?php

declare(strict_types=1);

namespace App\Modules\Media\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * T-M12-008 — Super Admin storage configuration update.
 *
 * The settings row's `disk` is one of the configured
 * disks in `config/filesystems.php`. Only disks in the
 * allow-list are accepted.
 */
class UpdateMediaStorageRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null
            && method_exists($user, 'hasRole')
            && $user->hasRole('super_admin');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'disk' => ['required', 'string', Rule::in(['media_local', 'media_minio', 'media_s3'])],
            'region' => ['nullable', 'string', 'max:64'],
            'bucket' => ['nullable', 'string', 'max:128'],
            'endpoint' => ['nullable', 'string', 'max:512'],
            'retention_days' => ['required', 'integer', 'min:0', 'max:3650'],
            'encryption_at_rest' => ['required', 'boolean'],
            'max_photo_bytes' => ['required', 'integer', 'min:0', 'max:1073741824'],
            'max_video_bytes' => ['required', 'integer', 'min:0', 'max:5368709120'],
            'max_document_bytes' => ['required', 'integer', 'min:0', 'max:536870912'],
        ];
    }
}
