<?php

declare(strict_types=1);

namespace App\Modules\Moderation\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Emitted by `ModerationService::review()` when a moderator
 * applies the approve / reject / merge / escalate decision
 * to a single report.
 *
 * The event captures the full moderator decision context so
 * downstream consumers (audit, notifications, analytics)
 * do not need to re-resolve the report or the DTO.
 *
 * Consumers:
 *  - Audit log writer — appends a row keyed by `reportId`
 *  - Notifications module (M9) — pushes a citizen ack on approve
 *  - Analytics (M14) — moderator throughput + override rate
 *
 * The merge / reject / escalate payloads reuse the same
 * shape; the `decision` field discriminates them.
 */
final class ReportModerated
{
    use Dispatchable;
    use SerializesModels;

    public const DECISION_APPROVE = 'approve';
    public const DECISION_REJECT = 'reject';
    public const DECISION_MERGE = 'merge';
    public const DECISION_ESCALATE = 'escalate';

    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public readonly string $reportId,
        public readonly string $decision,
        public readonly ?string $fromStatusId,
        public readonly string $toStatusId,
        public readonly ?string $fromCategoryId,
        public readonly ?string $toCategoryId,
        public readonly ?string $fromDepartmentId,
        public readonly ?string $toDepartmentId,
        public readonly ?string $remarks,
        public readonly bool $overrideAi,
        public readonly ?string $reasonCode,
        public readonly ?string $mergeIntoReportId,
        public readonly string $actorId,
        public readonly array $metadata = [],
    ) {}
}
