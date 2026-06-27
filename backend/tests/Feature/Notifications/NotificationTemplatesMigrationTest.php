<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

it('creates the notification_templates table with the expected columns', function (): void {
    expect(Schema::hasTable('notification_templates'))->toBeTrue();

    foreach ([
        'id', 'code', 'name', 'channel', 'subject', 'body',
        'variables', 'locale', 'version', 'active',
        'created_at', 'updated_at',
    ] as $col) {
        expect(Schema::hasColumn('notification_templates', $col))->toBeTrue("missing column: {$col}");
    }
});

it('roundtrips a template row with default locale en and active true', function (): void {
    $id = (string) Str::uuid();
    DB::table('notification_templates')->insert([
        'id' => $id,
        'code' => 'report_status_changed',
        'name' => 'Report status changed',
        'channel' => 'push',
        'subject' => 'Update on your report',
        'body' => 'Your report {{report_id}} moved to {{status}}.',
        'variables' => json_encode(['report_id', 'status']),
        'locale' => 'en',
        'version' => 1,
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $row = DB::table('notification_templates')->where('id', $id)->first();
    expect($row->code)->toBe('report_status_changed')
        ->and($row->locale)->toBe('en')
        ->and((int) $row->active)->toBe(1)
        ->and((int) $row->version)->toBe(1);
});

it('enforces uniqueness on (code, locale, version)', function (): void {
    $base = [
        'code' => 'report_status_changed',
        'name' => 'Test',
        'channel' => 'push',
        'body' => 'x',
        'locale' => 'en',
        'version' => 1,
        'active' => true,
    ];

    DB::table('notification_templates')->insert(array_merge($base, [
        'id' => (string) Str::uuid(),
        'created_at' => now(),
        'updated_at' => now(),
    ]));

    $threw = false;
    try {
        DB::table('notification_templates')->insert(array_merge($base, [
            'id' => (string) Str::uuid(),
            'created_at' => now(),
            'updated_at' => now(),
        ]));
    } catch (Throwable) {
        $threw = true;
    }
    expect($threw)->toBeTrue('expected duplicate (code, locale, version) to throw');
});

it('allows the same code in different locales or versions', function (): void {
    DB::table('notification_templates')->insert([
        'id' => (string) Str::uuid(),
        'code' => 'report_status_changed',
        'name' => 'en',
        'channel' => 'push',
        'body' => 'en body',
        'locale' => 'en',
        'version' => 1,
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    DB::table('notification_templates')->insert([
        'id' => (string) Str::uuid(),
        'code' => 'report_status_changed',
        'name' => 'hi',
        'channel' => 'push',
        'body' => 'hi body',
        'locale' => 'hi',
        'version' => 1,
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    DB::table('notification_templates')->insert([
        'id' => (string) Str::uuid(),
        'code' => 'report_status_changed',
        'name' => 'en v2',
        'channel' => 'push',
        'body' => 'en v2 body',
        'locale' => 'en',
        'version' => 2,
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    expect(DB::table('notification_templates')->where('code', 'report_status_changed')->count())->toBe(3);
});
