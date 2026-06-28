<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Services;

use App\Modules\Notifications\Exceptions\MissingTemplateVariableException;
use App\Modules\Notifications\Exceptions\TemplateNotFoundException;
use App\Modules\Notifications\Models\NotificationTemplate;
use InvalidArgumentException;

/**
 * Resolves a `NotificationTemplate` for a given
 * `(code, locale)` pair and renders its body with
 * variable interpolation.
 *
 * Lookup rules (per docs/04 §13):
 *  1. `(code, locale, version = max(active))` if `locale` is set
 *  2. fallback to `(code, 'en', version)` if no active row for
 *     the requested locale
 *  3. raise a `TemplateNotFoundException` otherwise
 *
 * Interpolation grammar (per docs/04 §13):
 *  - `{var_name}` is replaced with the matching key from
 *    the `$variables` map (string / number / bool / null)
 *  - The set of placeholders in the template body MUST
 *    be a subset of the supplied variable keys; unknown
 *    placeholders raise a `MissingTemplateVariableException`
 *  - Escape sequences: `\{` and `\}` produce literal braces
 *    (used when a body contains an actual `{`)
 *  - Arrays are JSON-encoded for inline rendering
 *
 * The engine is pure: no I/O, no Eloquent state mutation.
 */
class TemplateEngine
{
    private const PLACEHOLDER_REGEX = '/(?<!\\\\)\{([a-zA-Z0-9_\\.]+)\}/';

    /**
     * @param  string  $code  Template code (e.g. `report.assigned`)
     * @param  array<string, mixed>  $variables  Variable map
     * @param  string|null  $locale  Preferred locale (`en`, `kn`, …);
     *                               null = platform default `en`
     * @return array{0: NotificationTemplate, 1: array<string, string>} [template, rendered]
     *
     * @throws TemplateNotFoundException No active template for the code
     * @throws MissingTemplateVariableException Body has a placeholder the caller did not provide
     */
    public function render(string $code, array $variables, ?string $locale = null): array
    {
        $template = $this->resolve($code, $locale);

        $placeholders = $this->placeholders($template);
        $missing = array_diff($placeholders, array_keys($variables));

        if ($missing !== []) {
            throw new MissingTemplateVariableException(
                "Template '{$template->code}' requires missing variable(s): ".implode(', ', $missing),
            );
        }

        $rendered = [
            'subject' => $this->interpolate((string) ($template->subject ?? ''), $variables),
            'body' => $this->interpolate((string) ($template->body ?? ''), $variables),
        ];

        return [$template, $rendered];
    }

    /**
     * Returns the active template for the (code, locale) pair.
     * Falls back to `en` if no active row matches the locale.
     */
    public function resolve(string $code, ?string $locale = null): NotificationTemplate
    {
        $locale ??= 'en';

        $template = $this->findActive($code, $locale);

        if ($template !== null) {
            return $template;
        }

        if ($locale !== 'en') {
            $template = $this->findActive($code, 'en');

            if ($template !== null) {
                return $template;
            }
        }

        throw new TemplateNotFoundException(
            "No active notification template for code='{$code}' locale='{$locale}' (or 'en' fallback).",
        );
    }

    /**
     * Return the placeholder names declared by the template body + subject.
     *
     * @return list<string>
     */
    public function placeholders(NotificationTemplate $template): array
    {
        $haystack = (string) ($template->subject ?? '')."\n".(string) ($template->body ?? '');
        preg_match_all(self::PLACEHOLDER_REGEX, $haystack, $m);

        $names = $m[1] ?? [];
        $unique = array_values(array_unique($names));

        sort($unique);

        return $unique;
    }

    private function findActive(string $code, string $locale): ?NotificationTemplate
    {
        return NotificationTemplate::query()
            ->where('code', $code)
            ->where('locale', $locale)
            ->where('active', true)
            ->orderByDesc('version')
            ->first();
    }

    /**
     * @param  array<string, mixed>  $variables
     */
    private function interpolate(string $text, array $variables): string
    {
        // First, turn `\{` and `\}` into literal `{` and `}` in
        // the OUTPUT only (the placeholders are matched on the
        // unescaped text but the escape markers are consumed).
        $rendered = preg_replace_callback(
            '/\\\\([{}])|(?<!\\\\)\{([a-zA-Z0-9_\\.]+)\}/',
            function (array $m) use ($variables): string {
                if (isset($m[1]) && $m[1] !== '') {
                    // Escaped brace: emit the bare brace.
                    return $m[1];
                }

                $key = $m[2];

                if (! array_key_exists($key, $variables)) {
                    throw new MissingTemplateVariableException("Missing template variable: {$key}");
                }

                $value = $variables[$key];

                if (is_scalar($value) || $value === null) {
                    return (string) ($value ?? '');
                }

                if (is_array($value)) {
                    return (string) json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                }

                throw new InvalidArgumentException("Template variable '{$key}' must be scalar, null, or array.");
            },
            $text,
        );

        return $rendered ?? $text;
    }
}
