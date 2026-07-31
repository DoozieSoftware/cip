<?php

declare(strict_types=1);

namespace App\Modules\AI\Support;

use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class GoogleServiceAccountTokenProvider
{
    private ?string $accessToken = null;

    private int $expiresAt = 0;

    public function __construct(
        private readonly string $credentialsPath,
        private readonly ?HttpFactory $http = null,
    ) {}

    public function token(): string
    {
        if ($this->accessToken !== null && time() < $this->expiresAt - 60) {
            return $this->accessToken;
        }

        $credentials = $this->credentials();
        $tokenUri = $this->stringValue($credentials, 'token_uri');
        $assertion = $this->signedJwt($credentials);
        $client = $this->http instanceof HttpFactory
            ? $this->http->asForm()
            : Http::asForm();

        $response = $client->post($tokenUri, [
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $assertion,
        ]);

        if (! $response->successful()) {
            throw new RuntimeException(sprintf(
                'google_oauth_error: status=%d body=%s',
                $response->status(),
                substr($response->body(), 0, 500),
            ));
        }

        $payload = $response->json();
        $token = is_array($payload) && isset($payload['access_token']) && is_string($payload['access_token'])
            ? $payload['access_token']
            : '';

        if ($token === '') {
            throw new RuntimeException('google_oauth_error: missing access_token');
        }

        $expiresIn = is_array($payload) && isset($payload['expires_in']) && is_numeric($payload['expires_in'])
            ? (int) $payload['expires_in']
            : 3600;

        $this->accessToken = $token;
        $this->expiresAt = time() + $expiresIn;

        return $token;
    }

    /**
     * @return array<string, mixed>
     */
    private function credentials(): array
    {
        if ($this->credentialsPath === '' || ! is_file($this->credentialsPath)) {
            throw new RuntimeException('google_oauth_error: service_account_file_missing');
        }

        $decoded = json_decode((string) file_get_contents($this->credentialsPath), true);

        if (! is_array($decoded)) {
            throw new RuntimeException('google_oauth_error: invalid_service_account_json');
        }

        if (($decoded['type'] ?? null) !== 'service_account') {
            throw new RuntimeException('google_oauth_error: unsupported_credentials_type');
        }

        $normalized = [];

        foreach ($decoded as $key => $value) {
            if (is_string($key)) {
                $normalized[$key] = $value;
            }
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $credentials
     */
    private function signedJwt(array $credentials): string
    {
        $now = time();
        $header = ['alg' => 'RS256', 'typ' => 'JWT'];
        $claims = [
            'iss' => $this->stringValue($credentials, 'client_email'),
            'scope' => 'https://www.googleapis.com/auth/cloud-platform',
            'aud' => $this->stringValue($credentials, 'token_uri'),
            'iat' => $now,
            'exp' => $now + 3600,
        ];

        $headerJson = json_encode($header, JSON_THROW_ON_ERROR);
        $claimsJson = json_encode($claims, JSON_THROW_ON_ERROR);

        if (! is_string($headerJson) || ! is_string($claimsJson)) {
            throw new RuntimeException('google_oauth_error: jwt_json_encode_failed');
        }

        $signingInput = $this->base64UrlEncode($headerJson)
            .'.'.$this->base64UrlEncode($claimsJson);

        $signature = '';
        $privateKey = $this->stringValue($credentials, 'private_key');

        if (! openssl_sign($signingInput, $signature, $privateKey, OPENSSL_ALGO_SHA256)) {
            throw new RuntimeException('google_oauth_error: jwt_sign_failed');
        }

        if (! is_string($signature) || $signature === '') {
            throw new RuntimeException('google_oauth_error: jwt_signature_missing');
        }

        return $signingInput.'.'.$this->base64UrlEncode($signature);
    }

    /**
     * @param  array<string, mixed>  $values
     */
    private function stringValue(array $values, string $key): string
    {
        $value = $values[$key] ?? null;

        if (! is_string($value) || $value === '') {
            throw new RuntimeException("google_oauth_error: missing_{$key}");
        }

        return $value;
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
