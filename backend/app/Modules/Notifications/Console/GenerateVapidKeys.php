<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Console;

use Illuminate\Console\Command;

/**
 * Generate a VAPID EC P-256 keypair for Web Push (T-M13).
 *
 * Prints the public key (safe for the browser) and the private
 * key (server-only). Set VAPID_PUBLIC_KEY in the citizen PWA
 * config / backend .env. The private key must never be committed.
 */
class GenerateVapidKeys extends Command
{
    protected $signature = 'notifications:vapid';

    protected $description = 'Generate a VAPID EC P-256 keypair for Web Push';

    public function handle(): int
    {
        $res = openssl_pkey_new([
            'curve_name' => 'prime256v1',
            'private_key_type' => OPENSSL_KEYTYPE_EC,
        ]);

        if ($res === false) {
            $this->error('Failed to generate VAPID keypair: '.openssl_error_string());

            return self::FAILURE;
        }

        $exported = openssl_pkey_get_private($res);
        $detail = openssl_pkey_get_details($exported);

        if ($detail === false || ! isset($detail['ec']['x'], $detail['ec']['y'], $detail['ec']['d'])) {
            $this->error('Failed to read VAPID keypair details.');

            return self::FAILURE;
        }

        $x = str_pad((string) $detail['ec']['x'], 32, "\0", STR_PAD_LEFT);
        $y = str_pad((string) $detail['ec']['y'], 32, "\0", STR_PAD_LEFT);
        $d = str_pad((string) $detail['ec']['d'], 32, "\0", STR_PAD_LEFT);

        // VAPID public key = base64url of the uncompressed EC point (0x04 || X || Y).
        $public = rtrim(strtr(base64_encode("\x04".$x.$y), '+/', '-_'), '=');
        // VAPID private key = base64url of the raw private scalar.
        $private = rtrim(strtr(base64_encode($d), '+/', '-_'), '=');

        $this->info('VAPID_PUBLIC_KEY='.$public);
        $this->info('VAPID_PRIVATE_KEY='.$private);

        return self::SUCCESS;
    }
}
