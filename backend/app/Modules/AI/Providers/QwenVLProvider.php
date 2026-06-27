<?php

declare(strict_types=1);

namespace App\Modules\AI\Providers;

use App\Modules\AI\Contracts\AIProviderInterface;
use Illuminate\Http\Client\Factory as HttpFactory;

/**
 * Qwen-VL provider — extends OpenAICompatibleProvider with
 * DashScope defaults (model `qwen-vl-plus`, temperature 0.2,
 * baseUrl pointing at the DashScope OpenAI-compatible mode
 * endpoint).
 *
 * Per docs/10 §7, the Qwen-VL model accepts multi-image
 * messages in the same `image_url` shape OpenAI uses, which
 * is why the parent class is a perfect base — only the
 * defaults change.
 */
class QwenVLProvider extends OpenAICompatibleProvider implements AIProviderInterface
{
    public const CODE = 'qwen-vl';

    public const DEFAULT_MODEL = 'qwen-vl-plus';

    public const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com';

    public const DEFAULT_TEMPERATURE = 0.2;

    public function __construct(
        string $apiKey = '',
        ?HttpFactory $http = null,
        int $timeoutMs = 30000,
    ) {
        parent::__construct(
            name: self::CODE,
            model: self::DEFAULT_MODEL,
            baseUrl: self::DEFAULT_BASE_URL,
            apiKey: $apiKey,
            timeoutMs: $timeoutMs,
            http: $http,
            temperature: self::DEFAULT_TEMPERATURE,
        );
    }
}
