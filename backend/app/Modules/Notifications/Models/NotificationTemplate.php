<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

class NotificationTemplate extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'notification_templates';

    protected $fillable = [
        'code', 'name', 'channel', 'subject', 'body',
        'variables', 'locale', 'version', 'active',
    ];

    protected $casts = [
        'variables' => 'array',
        'version' => 'integer',
        'active' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $template): void {
            $template->validateVariables();
        });
    }

    public function validateVariables(): void
    {
        $haystack = (string) ($this->subject ?? '')."\n".(string) ($this->body ?? '');
        preg_match_all('/(?<!\\\\)\{([a-zA-Z0-9_\\.]+)\}/', $haystack, $matches);

        $placeholders = array_values(array_unique($matches[1] ?? []));
        sort($placeholders);

        $declared = [];

        foreach ((array) ($this->variables ?? []) as $v) {
            if (is_string($v)) {
                $declared[] = $v;
            }
        }

        $declared = array_values(array_unique($declared));
        sort($declared);

        $missing = array_diff($placeholders, $declared);

        if ($missing !== []) {
            throw new InvalidArgumentException(
                "Template '{$this->code}' placeholders [".implode(', ', $missing).'] are not declared in variables.',
            );
        }

        $unused = array_diff($declared, $placeholders);

        if ($unused !== []) {
            throw new InvalidArgumentException(
                "Template '{$this->code}' declared variables [".implode(', ', $unused).'] are not used in subject or body.',
            );
        }
    }
}
