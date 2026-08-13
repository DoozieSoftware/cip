<?php

declare(strict_types=1);

namespace App\Modules\Public\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Privacy-safe product event. No account id, IP address, user-agent, or
 * free-form text is stored; the controller accepts a small allowlisted
 * property payload only.
 */
class ProductAnalyticsEvent extends Model
{
    use HasUuids;

    protected $table = 'product_analytics_events';

    /** @var list<string> */
    protected $fillable = ['event_code', 'properties', 'occurred_at'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'properties' => 'array',
            'occurred_at' => 'datetime',
        ];
    }
}
