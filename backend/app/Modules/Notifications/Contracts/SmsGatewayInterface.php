<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Contracts;

/**
 * Contract for SMS gateway providers.
 *
 * Per docs/03 §17 (Connectors / External APIs): every integration
 * must support retry, timeout, logging, audit, and health checks.
 * The interface stays intentionally narrow — providers are
 * implemented as Drivers bound to the contract in the service
 * container, selected by `config('cip.notifications.sms_driver')`.
 */
interface SmsGatewayInterface
{
    /**
     * Send a plain-text SMS to a single mobile number. Implementations
     * must NOT throw on transient failures — they should retry with
     * exponential backoff and log a security event if all retries
     * are exhausted. Fatal errors (invalid number) MUST throw.
     *
     * @param  string  $mobile  E.164 or 10-digit local format
     * @param  string  $message  Plain-text body; max length is provider-specific
     */
    public function send(string $mobile, string $message): void;
}
