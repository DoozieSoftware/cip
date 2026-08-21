<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Jobs;

use App\Modules\Authentication\Models\PushLoginChallenge;
use App\Modules\Notifications\Services\WebPushDeliveryService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Crypt;
use RuntimeException;

class SendPushLoginApprovalJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public int $timeout = 20;

    /** @var list<int> */
    public array $backoff = [5, 15];

    public function __construct(
        public readonly string $challengeId,
        public readonly string $encryptedApprovalSecret,
    ) {
        $this->onQueue('default');
    }

    public function handle(WebPushDeliveryService $push): void
    {
        $challenge = PushLoginChallenge::query()->with('user')->find($this->challengeId);

        if ($challenge === null
            || $challenge->user === null
            || $challenge->status !== 'pending'
            || $challenge->expires_at->isPast()) {
            return;
        }

        $approvalSecret = Crypt::decryptString($this->encryptedApprovalSecret);
        // Keep the secret in the URL fragment. Fragments are handled by the
        // browser and are not sent in HTTP requests, access logs, or referrers.
        $url = '/login/push/'.$challenge->id.'#'.rawurlencode($approvalSecret);
        $sent = $push->send(
            $challenge->user,
            'Approve sign in',
            'A device is requesting access to your CIP account. Approve only if this was you.',
            $url,
            ['challenge_id' => (string) $challenge->id],
        );

        if (! $sent) {
            throw new RuntimeException('Push login approval could not be delivered.');
        }
    }
}
