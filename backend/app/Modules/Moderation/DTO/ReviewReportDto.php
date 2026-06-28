<?php

declare(strict_types=1);

namespace App\Modules\Moderation\DTO;

use App\Modules\Shared\Exceptions\ApiException;
use Illuminate\Support\Str;

/**
 * Immutable payload describing a moderator's review decision.
 *
 * Built from a validated `StoreReviewRequest` (or built directly
 * in tests + the AI-assisted batch-review flow). The DTO is the
 * validated, immutable input to `ModerationService::review()`.
 *
 * The DTO is intentionally narrow: the four moderation decisions
 * (approve / reject / merge / escalate) all share the same wire
 * shape, with `decision` differentiating them. The service layer
 * dispatches on `decision` and ignores the irrelevant fields.
 *
 * @phpstan-type DecisionType 'approve'|'reject'|'merge'|'escalate'
 */
final readonly class ReviewReportDto
{
    public const DECISION_APPROVE = 'approve';
    public const DECISION_REJECT = 'reject';
    public const DECISION_MERGE = 'merge';
    public const DECISION_ESCALATE = 'escalate';

    public const ALLOWED_DECISIONS = [
        self::DECISION_APPROVE,
        self::DECISION_REJECT,
        self::DECISION_MERGE,
        self::DECISION_ESCALATE,
    ];

    /**
     * @param  DecisionType  $decision
     * @param  list<string>  $categoryIds
     * @param  array<string, mixed>  $extra
     */
    public function __construct(
        public string $decision,
        public ?string $departmentId = null,
        public ?string $categoryId = null,
        public array $categoryIds = [],
        public ?string $remarks = null,
        public bool $overrideAi = false,
        public ?string $mergeIntoReportId = null,
        public ?string $reasonCode = null,
        public array $extra = [],
    ) {}

    /**
     * Build from the wire-form-request validated payload. Throws
     * ApiException(422) when required fields are missing — this
     * catches controller bugs (validation should have already
     * failed), not user input.
     *
     * @param  array<string, mixed>  $validated
     */
    public static function fromArray(array $validated): self
    {
        $decision = strtolower(trim((string) ($validated['decision'] ?? '')));
        if (! in_array($decision, self::ALLOWED_DECISIONS, true)) {
            throw ApiException::validation(
                'invalid decision; expected one of: '.implode(', ', self::ALLOWED_DECISIONS),
                ['decision' => [$decision]],
            );
        }

        $categoryIds = $validated['category_ids'] ?? [];
        if (! is_array($categoryIds)) {
            $categoryIds = [];
        }
        $categoryIds = array_values(array_filter(
            array_map(static fn ($v): string => is_string($v) ? $v : (is_numeric($v) ? (string) $v : ''), $categoryIds),
            static fn (string $v): bool => $v !== '',
        ));

        $categoryId = $validated['category_id'] ?? null;
        if (is_string($categoryId) && $categoryId !== '') {
            // Prepend the single category_id to the array form so the
            // downstream service sees a single source of truth.
            array_unshift($categoryIds, $categoryId);
            $categoryIds = array_values(array_unique($categoryIds));
        }

        $remarks = $validated['remarks'] ?? null;
        if (! is_string($remarks)) {
            $remarks = null;
        } elseif (Str::length($remarks) > 2000) {
            $remarks = Str::limit($remarks, 2000, '');
        }

        $reasonCode = $validated['reason_code'] ?? null;
        if (! is_string($reasonCode) || $reasonCode === '') {
            $reasonCode = null;
        }

        $mergeInto = $validated['merge_into_report_id'] ?? null;
        if (! is_string($mergeInto) || $mergeInto === '') {
            $mergeInto = null;
        }

        $departmentId = $validated['department_id'] ?? null;
        if (! is_string($departmentId) || $departmentId === '') {
            $departmentId = null;
        }

        return new self(
            decision: $decision,
            departmentId: $departmentId,
            categoryId: $categoryId !== null && is_string($categoryId) && $categoryId !== '' ? $categoryId : null,
            categoryIds: $categoryIds,
            remarks: $remarks,
            overrideAi: (bool) ($validated['override_ai'] ?? false),
            mergeIntoReportId: $mergeInto,
            reasonCode: $reasonCode,
            extra: array_diff_key($validated, array_flip([
                'decision', 'department_id', 'category_id', 'category_ids',
                'remarks', 'override_ai', 'merge_into_report_id', 'reason_code',
            ])),
        );
    }

    /**
     * Whether the moderator accepted the AI classification (no override).
     */
    public function acceptedAi(): bool
    {
        return ! $this->overrideAi;
    }
}
