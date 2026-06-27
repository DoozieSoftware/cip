<?php

declare(strict_types=1);

namespace App\Modules\AI\Exceptions;

use RuntimeException;

/**
 * Raised by AiResponseValidator when an AI provider
 * returns a payload that does not match the docs/10 §14
 * contract. The orchestrator catches this and marks the
 * job as `failed` (non-retryable — prompt drift is a
 * code/configuration issue, not a transient one).
 */
class InvalidAiResponseException extends RuntimeException
{
    /**
     * @param  array<string, mixed>  $context
     */
    public function __construct(string $message, public readonly array $context = [])
    {
        parent::__construct($message);
    }
}
