<?php

declare(strict_types=1);

use App\Modules\Notifications\Exceptions\MissingTemplateVariableException;
use App\Modules\Notifications\Exceptions\TemplateNotFoundException;
use App\Modules\Notifications\Models\NotificationTemplate;
use App\Modules\Notifications\Services\TemplateEngine;
use Illuminate\Support\Str;

beforeEach(function (): void {
    $this->engine = app(TemplateEngine::class);
});

it('resolves a template by code and locale and renders placeholders', function (): void {
    $tpl = createTemplate(code: 'report.assigned', locale: 'en', body: 'Hi {name}, report {code} is assigned to you.');

    [$resolved, $rendered] = $this->engine->render('report.assigned', [
        'name' => 'Anu',
        'code' => 'R-001',
    ]);

    expect($resolved->id)->toBe($tpl->id)
        ->and($rendered['body'])->toBe('Hi Anu, report R-001 is assigned to you.')
        ->and($rendered['subject'])->toBe('');
});

it('falls back to the `en` template when the requested locale has no active row', function (): void {
    $en = createTemplate(code: 'report.assigned', locale: 'en', body: 'Default body');

    [$resolved, $rendered] = $this->engine->render('report.assigned', [], 'kn');

    expect($resolved->id)->toBe($en->id)
        ->and($rendered['body'])->toBe('Default body');
});

it('throws TemplateNotFoundException when no template exists at all', function (): void {
    $this->engine->render('does.not.exist', []);
})->throws(TemplateNotFoundException::class);

it('throws MissingTemplateVariableException when a placeholder is absent', function (): void {
    createTemplate(code: 'report.assigned', locale: 'en', body: 'Hi {name}, ref {code}.');

    $this->engine->render('report.assigned', ['name' => 'Anu']);
})->throws(MissingTemplateVariableException::class);

it('renders the subject with the same interpolation rules', function (): void {
    createTemplate(code: 'report.assigned', locale: 'en', subject: 'Ref {code} assigned', body: 'Hi {name}');

    [, $rendered] = $this->engine->render('report.assigned', [
        'name' => 'Anu',
        'code' => 'R-001',
    ]);

    expect($rendered['subject'])->toBe('Ref R-001 assigned')
        ->and($rendered['body'])->toBe('Hi Anu');
});

it('preserves escaped braces as literal characters', function (): void {
    createTemplate(code: 'report.assigned', locale: 'en', body: 'Use the syntax \\{name\\} literal in docs.');

    [, $rendered] = $this->engine->render('report.assigned', []);

    expect($rendered['body'])->toBe('Use the syntax {name} literal in docs.');
});

it('returns the placeholder list in sorted order', function (): void {
    $tpl = createTemplate(code: 'report.assigned', locale: 'en', body: '{zeta} {alpha} {alpha} {beta}');

    $names = $this->engine->placeholders($tpl);

    expect($names)->toBe(['alpha', 'beta', 'zeta']);
});

it('renders null as an empty string', function (): void {
    createTemplate(code: 'report.assigned', locale: 'en', body: 'Title: {title}');

    [, $rendered] = $this->engine->render('report.assigned', ['title' => null]);

    expect($rendered['body'])->toBe('Title: ');
});

it('renders array values as JSON', function (): void {
    createTemplate(code: 'report.assigned', locale: 'en', body: 'Data: {data}');

    [, $rendered] = $this->engine->render('report.assigned', [
        'data' => ['k' => 'v', 'n' => 1],
    ]);

    expect($rendered['body'])->toContain('"k":"v"')
        ->and($rendered['body'])->toContain('"n":1');
});

it('picks the highest version when multiple active templates exist for the same (code, locale)', function (): void {
    $v1 = createTemplate(code: 'report.assigned', locale: 'en', body: 'v1 body', version: 1);
    $v3 = createTemplate(code: 'report.assigned', locale: 'en', body: 'v3 body', version: 3);

    [$resolved] = $this->engine->render('report.assigned', []);

    expect($resolved->id)->toBe($v3->id)
        ->and($resolved->id)->not->toBe($v1->id);
});

it('skips inactive templates even when they are the highest version', function (): void {
    $inactive = createTemplate(code: 'report.assigned', locale: 'en', body: 'inactive v9', version: 9, active: false);
    $active = createTemplate(code: 'report.assigned', locale: 'en', body: 'active v1', version: 1, active: true);

    [$resolved] = $this->engine->render('report.assigned', []);

    expect($resolved->id)->toBe($active->id)
        ->and($resolved->id)->not->toBe($inactive->id);
});

function createTemplate(string $code, string $locale, string $body = 'Body', ?string $subject = null, int $version = 1, bool $active = true): NotificationTemplate
{
    $tpl = new NotificationTemplate([
        'code' => $code,
        'name' => Str::title(str_replace('.', ' ', $code)),
        'channel' => 'email',
        'subject' => $subject,
        'body' => $body,
        'locale' => $locale,
        'version' => $version,
        'active' => $active,
    ]);
    $tpl->id = (string) Str::uuid();
    $tpl->save();

    return $tpl;
}
