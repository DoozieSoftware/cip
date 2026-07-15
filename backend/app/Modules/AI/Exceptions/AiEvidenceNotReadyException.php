<?php

declare(strict_types=1);

namespace App\Modules\AI\Exceptions;

use RuntimeException;

/**
 * Thrown by `AiPipelineOrchestrator` when no vision-classifiable
 * evidence (photo/video) exists for the report yet.
 *
 * This is a *transient* condition, not a permanent failure: the
 * citizen PWA uploads evidence as a separate API call that usually
 * arrives after the report enters `ai_processing`. The job is
 * configured with a long retry budget and the `ReportMediaUploaded`
 * event re-dispatches it the moment the asset lands, so the queue
 * worker keeps retrying until evidence is present rather than
 * failing fast.
 */
final class AiEvidenceNotReadyException extends RuntimeException {}
