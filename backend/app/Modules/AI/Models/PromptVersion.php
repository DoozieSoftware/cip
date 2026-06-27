<?php

declare(strict_types=1);

namespace App\Modules\AI\Models;

use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * `prompt_versions` row per docs/04 §10 and docs/10 §15.
 *
 * Prompt registry with a `draft | approved | deprecated`
 * lifecycle. The Super Admin Portal (M12) flips the
 * lifecycle in a single transaction; only one row per
 * `(name, status=approved)` is meant to be the "current"
 * prompt at any time.
 *
 *  - `name` is the prompt slug (e.g. `category_classifier`,
 *    `severity_estimator`, `ai_labeller`)
 *  - `version` is a per-name monotonic int
 *  - `provider_code` references `ai_provider_configs.code`
 *    loosely (no FK) — matching the spec
 *  - `expected_json_schema` is the JSON shape the
 *    orchestrator validates the provider's response against
 *    before publishing `ai_label` to `reports.ai_label`
 *
 * @property string $id
 * @property string $name
 * @property int $version
 * @property string|null $purpose
 * @property string $provider_code
 * @property string $prompt_text
 * @property array<string, mixed>|null $expected_json_schema
 * @property string $status
 * @property string|null $approved_by
 * @property Carbon|null $approved_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class PromptVersion extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'prompt_versions';

    protected $fillable = [
        'name', 'version', 'purpose', 'provider_code',
        'prompt_text', 'expected_json_schema', 'status',
        'approved_by', 'approved_at',
    ];

    protected $casts = [
        'version' => 'integer',
        'expected_json_schema' => 'array',
        'approved_at' => 'datetime',
    ];

    public const STATUS_DRAFT = 'draft';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_DEPRECATED = 'deprecated';

    /**
     * @return BelongsTo<User, self>
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
