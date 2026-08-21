<?php

declare(strict_types=1);

use Illuminate\Cache\FileStore;
use Illuminate\Cache\Repository;
use Illuminate\Filesystem\Filesystem;

it('supports every cache operation used by the application on the file store', function (): void {
    $files = new Filesystem;
    $directory = sys_get_temp_dir().'/cip-cache-compatibility-'.bin2hex(random_bytes(8));
    $cache = new Repository(new FileStore($files, $directory));

    try {
        expect($cache->supportsTags())->toBeFalse()
            ->and($cache->put('plain', 'value', 60))->toBeTrue()
            ->and($cache->get('plain'))->toBe('value')
            ->and($cache->has('plain'))->toBeTrue()
            ->and($cache->remember('remembered', 60, fn (): string => 'cached'))->toBe('cached')
            ->and($cache->add('counter', 0, 60))->toBeTrue()
            ->and($cache->increment('counter', 2))->toBe(2)
            ->and($cache->forget('plain'))->toBeTrue()
            ->and($cache->get('plain'))->toBeNull();
    } finally {
        $files->deleteDirectory($directory);
    }
});
